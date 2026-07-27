import { Injectable } from '@nestjs/common';
import { NoticeScraper } from '../interfaces/notice-scraper.interface';
import { UpscScraper } from './upsc.scraper';
import { SscScraper } from './ssc.scraper';
import { RrbScraper } from './rrb.scraper';
import { DataGovNcsScraper } from './data-gov-ncs.scraper';
import { RssNoticeScraper } from './rss-notice.scraper';

/**
 * Resolves a SourceConfig.scraperClass string to its NoticeScraper instance.
 * The processor looks scrapers up by name (spec Phase 4). Add a new source by
 * implementing NoticeScraper, registering it as a provider in ScrapingModule,
 * injecting it here, and appending it to the list below.
 */
@Injectable()
export class NoticeScraperFactory {
  private readonly byClass: Map<string, NoticeScraper>;

  constructor(
    upsc: UpscScraper,
    ssc: SscScraper,
    rrb: RrbScraper,
    dataGov: DataGovNcsScraper,
    rss: RssNoticeScraper,
  ) {
    const all: NoticeScraper[] = [upsc, ssc, rrb, dataGov, rss];
    this.byClass = new Map(all.map((s) => [s.scraperClass, s]));
  }

  get(scraperClass: string): NoticeScraper | undefined {
    return this.byClass.get(scraperClass);
  }
}
