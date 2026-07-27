import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { NOTICE_SCRAPER_QUEUE } from './scraping.constants';
import { NOTICE_SOURCES } from './sources/notice-source.registry';
import { EXPIRE_NOTICES_JOB } from './notice-scraper.processor';

/**
 * Registers ONE repeatable BullMQ job PER SOURCE (spec Phase 4) — never a single
 * loop-all-sources job — so each source runs and retries independently. Gated by
 * SCRAPE_SCHEDULE_ENABLED (same semantics as the legacy scraper). A stable
 * jobId per source (`scrape-<id>`) makes re-registration on every restart
 * idempotent instead of piling up duplicate repeatables.
 */
@Injectable()
export class NoticeScraperProducer implements OnModuleInit {
  private readonly logger = new Logger(NoticeScraperProducer.name);

  constructor(
    @InjectQueue(NOTICE_SCRAPER_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled =
      String(this.config.get('SCRAPE_SCHEDULE_ENABLED') ?? 'false') === 'true';
    if (!enabled) {
      this.logger.log(
        'Notice scrape scheduler disabled (set SCRAPE_SCHEDULE_ENABLED=true).',
      );
      return;
    }
    const every = Number(
      this.config.get('SCRAPE_SOURCE_INTERVAL_MS') ?? 30 * 60 * 1000,
    );

    for (const source of NOTICE_SOURCES) {
      await this.queue.add(
        'scrape-source',
        { sourceId: source.id },
        {
          repeat: { every },
          jobId: `scrape-${source.id}`,
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      );
    }
    // Daily expiry sweep on the same queue (spec Phase 6).
    const expiryEvery = Number(
      this.config.get('NOTICE_EXPIRY_INTERVAL_MS') ?? 24 * 60 * 60 * 1000,
    );
    await this.queue.add(
      EXPIRE_NOTICES_JOB,
      {},
      {
        repeat: { every: expiryEvery },
        jobId: 'notice-expiry',
        removeOnComplete: 5,
        removeOnFail: 10,
      },
    );

    this.logger.log(
      `Notice scrape scheduler enabled: ${NOTICE_SOURCES.length} per-source jobs (every ${every}ms) + daily expiry.`,
    );
  }

  /** Admin manual trigger for the expiry sweep (one-off). */
  async triggerExpiry(): Promise<void> {
    await this.queue.add(
      EXPIRE_NOTICES_JOB,
      {},
      { removeOnComplete: 5, removeOnFail: 10 },
    );
  }

  /** Admin manual trigger for a single source (one-off, non-repeating). */
  async triggerSource(sourceId: string): Promise<void> {
    await this.queue.add(
      'scrape-source',
      { sourceId },
      { removeOnComplete: 20, removeOnFail: 50 },
    );
  }

  /** Admin manual trigger for every source (independent one-off jobs). */
  async triggerAll(): Promise<void> {
    for (const source of NOTICE_SOURCES) {
      await this.triggerSource(source.id);
    }
  }
}
