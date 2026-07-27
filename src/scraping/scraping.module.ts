import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { SCRAPING_QUEUE, NOTICE_SCRAPER_QUEUE } from './scraping.constants';
import { ScraperService } from './scraper.service';
import { StrapiWriterService } from './strapi-writer.service';
import { ScrapingProducer } from './scraping.producer';
import { ScrapingConsumer } from './scraping.consumer';
import { ScrapingController } from './scraping.controller';
import { ScrapeJobRecorder } from './monitor/scrape-job-recorder.service';
import { NormalizerService } from './normalize/normalizer.service';
import { AiEnrichmentService } from './enrich/ai-enrichment.service';
import { UsersModule } from '../modules/users/users.module';

// Notices pipeline (official sources -> Postgres `notices`).
import { ScraperHttpService } from './sources/scraper-http.service';
import { UpscScraper } from './scrapers/upsc.scraper';
import { SscScraper } from './scrapers/ssc.scraper';
import { RrbScraper } from './scrapers/rrb.scraper';
import { DataGovNcsScraper } from './scrapers/data-gov-ncs.scraper';
import { RssNoticeScraper } from './scrapers/rss-notice.scraper';
import { NoticeScraperFactory } from './scrapers/notice-scraper.factory';
import { NoticeIngestService } from './ingest/notice-ingest.service';
import { NoticeClassifierService } from './ingest/notice-classifier.service';
import { NoticeExpiryService } from './ingest/notice-expiry.service';
import { NoticeScraperProducer } from './notice-scraper.producer';
import { NoticeScraperProcessor } from './notice-scraper.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: SCRAPING_QUEUE },
      { name: NOTICE_SCRAPER_QUEUE },
    ),
    // Surface both scraping queues in the Bull-Board dashboard at /queues.
    BullBoardModule.forFeature(
      { name: SCRAPING_QUEUE, adapter: BullMQAdapter },
      { name: NOTICE_SCRAPER_QUEUE, adapter: BullMQAdapter },
    ),
    // Provides UsersService for ClerkAuthGuard (used by the admin controller).
    UsersModule,
  ],
  controllers: [ScrapingController],
  providers: [
    // Legacy RSS/HTML -> Strapi pipeline.
    ScraperService,
    StrapiWriterService,
    ScrapingProducer,
    ScrapingConsumer,
    ScrapeJobRecorder,
    NormalizerService,
    AiEnrichmentService,
    // Notices pipeline (official sources -> Postgres).
    ScraperHttpService,
    UpscScraper,
    SscScraper,
    RrbScraper,
    DataGovNcsScraper,
    RssNoticeScraper,
    NoticeScraperFactory,
    NoticeIngestService,
    NoticeClassifierService,
    NoticeExpiryService,
    NoticeScraperProducer,
    NoticeScraperProcessor,
  ],
})
export class ScrapingModule {}
