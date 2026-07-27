import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { SCRAPING_QUEUE } from './scraping.constants';
import { SOURCE_SCRAPERS } from './sources/source-scraper.registry';
import { SCRAPE_SOURCES } from './sources.registry';

@Injectable()
export class ScrapingProducer implements OnModuleInit {
  private readonly logger = new Logger(ScrapingProducer.name);

  constructor(
    @InjectQueue(SCRAPING_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  /**
   * Register ONE repeatable job PER SOURCE (modular official scrapers + legacy
   * RSS/HTML/api sources), only when explicitly enabled via env. Per-source
   * scheduling keeps runs independent; a stable `jobId` per source makes
   * re-registration on restart idempotent. There is intentionally no
   * `scrape-all` repeatable (that would double-run every source) — scrape-all
   * remains a manual admin trigger only.
   */
  async onModuleInit(): Promise<void> {
    const enabled =
      String(this.config.get('SCRAPE_SCHEDULE_ENABLED') ?? 'false') === 'true';
    if (!enabled) {
      this.logger.log(
        'Scrape scheduler disabled (set SCRAPE_SCHEDULE_ENABLED=true to enable).',
      );
      return;
    }
    const defaultEvery = Number(
      this.config.get('SCRAPE_SOURCE_INTERVAL_MS') ?? 30 * 60 * 1000,
    );

    const keys: { key: string; every: number }[] = [
      ...SOURCE_SCRAPERS.filter((s) => s.enabled).map((s) => ({
        key: s.key,
        every: s.scheduleMs ?? defaultEvery,
      })),
      ...SCRAPE_SOURCES.filter((s) => s.enabled).map((s) => ({
        key: s.key,
        every: defaultEvery,
      })),
    ];

    for (const { key, every } of keys) {
      await this.queue.add(
        'scrape-source',
        { key },
        {
          repeat: { every },
          jobId: `scrape-${key}-repeatable`,
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      );
    }
    this.logger.log(
      `Scrape scheduler enabled: ${keys.length} per-source jobs (default every ${defaultEvery}ms).`,
    );
  }

  async triggerAll(): Promise<void> {
    await this.queue.add(
      'scrape-all',
      {},
      { removeOnComplete: 20, removeOnFail: 50 },
    );
  }

  async triggerSource(key: string): Promise<void> {
    await this.queue.add(
      'scrape-source',
      { key },
      { removeOnComplete: 20, removeOnFail: 50 },
    );
  }
}
