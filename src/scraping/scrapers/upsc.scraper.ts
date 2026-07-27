import { Injectable } from '@nestjs/common';
import {
  NoticeScraper,
  RawNotice,
} from '../interfaces/notice-scraper.interface';
import type { SourceConfig } from '../sources/notice-source.registry';
import { ScraperHttpService } from '../sources/scraper-http.service';
import { classifyNoticeType } from '../utils/classify-notice-type.util';
import { parseIndianDate } from '../utils/parse-indian-date.util';

/**
 * UPSC — parses the server-rendered "What's New" list on upsc.gov.in. That
 * block (`h2.whats-heading` + `.whats-new` container) holds every notice:
 * Advertisements, Final/Written Results, e-Admit Cards, Press Notes, Interview
 * details. Static HTML — verified live with curl, cheerio is sufficient.
 */
@Injectable()
export class UpscScraper implements NoticeScraper {
  readonly scraperClass = 'UpscScraper';
  private readonly base = 'https://upsc.gov.in/';

  constructor(private readonly http: ScraperHttpService) {}

  async scrape(_source: SourceConfig): Promise<RawNotice[]> {
    const $ = await this.http.loadHtml(this.base);
    const out: RawNotice[] = [];
    const seen = new Set<string>();

    $('.whats-new a').each((_, a) => {
      const title = $(a).text().replace(/\s+/g, ' ').trim();
      const href = $(a).attr('href') || '';
      if (title.length < 15 || !href) return;

      const sourceUrl = this.http.absolute(href, this.base);
      if (seen.has(sourceUrl)) return;
      seen.add(sourceUrl);

      out.push({
        title,
        sourceUrl,
        publishedDate: parseIndianDate(title),
        noticeType: classifyNoticeType(title),
        rawFields: { href },
      });
    });

    return out.slice(0, this.http.maxItems);
  }
}
