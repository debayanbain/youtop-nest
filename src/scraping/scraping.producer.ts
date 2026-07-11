import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { SCRAPING_QUEUE } from './scraping.constants';

@Injectable()
export class ScrapingProducer implements OnModuleInit {
  private readonly logger = new Logger(ScrapingProducer.name);

  constructor(
    @InjectQueue(SCRAPING_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  /** Register the recurring scrape only when explicitly enabled via env. */
  async onModuleInit(): Promise<void> {
    const enabled =
      String(this.config.get('SCRAPE_SCHEDULE_ENABLED') ?? 'false') === 'true';
    if (!enabled) {
      this.logger.log(
        'Scrape scheduler disabled (set SCRAPE_SCHEDULE_ENABLED=true to enable).',
      );
      return;
    }
    const every = Number(
      this.config.get('SCRAPE_INTERVAL_MS') ?? 6 * 60 * 60 * 1000,
    );
    await this.queue.add(
      'scrape-all',
      {},
      {
        repeat: { every },
        jobId: 'scrape-all-repeatable',
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );
    this.logger.log(`Scrape scheduler enabled: every ${every}ms.`);
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
