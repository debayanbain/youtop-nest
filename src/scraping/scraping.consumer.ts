import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SCRAPING_QUEUE } from './scraping.constants';
import { ScraperService } from './scraper.service';

interface ScrapeJobData {
  key?: string;
}

@Processor(SCRAPING_QUEUE, {
  stalledInterval: 60 * 60 * 1000,
  maxStalledCount: 1,
})
export class ScrapingConsumer extends WorkerHost {
  private readonly logger = new Logger(ScrapingConsumer.name);

  constructor(private readonly scraper: ScraperService) {
    super();
  }

  async process(job: Job<ScrapeJobData>): Promise<void> {
    if (job.name === 'scrape-source' && job.data?.key) {
      const result = await this.scraper.scrapeSourceByKey(job.data.key);
      this.logger.log(`scrape-source done: ${JSON.stringify(result)}`);
      return;
    }
    const results = await this.scraper.scrapeAll();
    this.logger.log(`scrape-all done: ${JSON.stringify(results)}`);
  }
}
