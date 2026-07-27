import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NOTICE_SCRAPER_QUEUE } from './scraping.constants';
import { NOTICE_SOURCES } from './sources/notice-source.registry';
import { NoticeScraperFactory } from './scrapers/notice-scraper.factory';
import { NoticeIngestService } from './ingest/notice-ingest.service';
import { NoticeExpiryService } from './ingest/notice-expiry.service';

interface NoticeScrapeJobData {
  sourceId?: string;
}

/** Job name for the daily expiry sweep (shares the notice-scraper queue). */
export const EXPIRE_NOTICES_JOB = 'expire-notices';

/**
 * Handles one source per job (spec Phase 4): resolve the source, run its
 * scraper, ingest each RawNotice. One job per source means a slow/failing
 * source only fails its own job — the others keep their independent schedule
 * and retry. Long stalledInterval because a scrape can legitimately take a
 * while on a cold government host.
 */
@Processor(NOTICE_SCRAPER_QUEUE, {
  stalledInterval: 60 * 60 * 1000,
  maxStalledCount: 1,
})
export class NoticeScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(NoticeScraperProcessor.name);

  constructor(
    private readonly factory: NoticeScraperFactory,
    private readonly ingest: NoticeIngestService,
    private readonly expiry: NoticeExpiryService,
  ) {
    super();
  }

  async process(job: Job<NoticeScrapeJobData>): Promise<void> {
    if (job.name === EXPIRE_NOTICES_JOB) {
      await this.expiry.run();
      return;
    }

    const sourceId = job.data?.sourceId;
    const source = NOTICE_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      this.logger.warn(`No source registered for id "${sourceId}"`);
      return;
    }
    const scraper = this.factory.get(source.scraperClass);
    if (!scraper) {
      this.logger.warn(
        `No scraper registered for class "${source.scraperClass}" (source ${source.id})`,
      );
      return;
    }

    const raws = await scraper.scrape(source);
    let inserted = 0;
    let skipped = 0;
    for (const raw of raws) {
      try {
        const { inserted: ins } = await this.ingest.upsert(
          source.id,
          source.orgName,
          raw,
        );
        if (ins) inserted++;
        else skipped++;
      } catch (err) {
        skipped++;
        this.logger.warn(
          `[${source.id}] ingest failed for "${raw.title.slice(0, 60)}": ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `[${source.id}] scraped=${raws.length} inserted=${inserted} skipped=${skipped}`,
    );
  }
}
