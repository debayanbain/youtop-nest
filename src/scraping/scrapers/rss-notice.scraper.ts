import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';
import {
  NoticeScraper,
  RawNotice,
} from '../interfaces/notice-scraper.interface';
import type { SourceConfig } from '../sources/notice-source.registry';
import { ScraperHttpService } from '../sources/scraper-http.service';
import { classifyNoticeType } from '../utils/classify-notice-type.util';
import { parseIndianDate } from '../utils/parse-indian-date.util';

/**
 * One scraper for EVERY RSS feed (spec-friendly: RSS is a uniform format, so a
 * single class keyed by `source.url` is right — unlike HTML, where per-site
 * classes are needed). This is the breadth layer that pushes the board toward
 * "every Indian job post": FreeJobAlert + Google News aggregate nearly all
 * sarkari vacancies/results nationwide.
 *
 * Per source it optionally include/exclude-filters titles and falls back to
 * `source.defaultType` when the keyword heuristic is unsure (e.g. a jobs feed).
 * Fetched via ScraperHttpService (config UA + retry); rss-parser only parses.
 */
@Injectable()
export class RssNoticeScraper implements NoticeScraper {
  readonly scraperClass = 'RssNoticeScraper';
  private readonly rss = new Parser();

  constructor(private readonly http: ScraperHttpService) {}

  async scrape(source: SourceConfig): Promise<RawNotice[]> {
    const xml = await this.http.fetchText(source.url);
    const feed = await this.rss.parseString(xml);

    const inc = source.titleInclude
      ? new RegExp(source.titleInclude, 'i')
      : null;
    const exc = source.titleExclude
      ? new RegExp(source.titleExclude, 'i')
      : null;
    const fallback = source.defaultType ?? null;

    const out: RawNotice[] = [];
    const seen = new Set<string>();

    for (const item of feed.items ?? []) {
      const title = (item.title || '').replace(/\s+/g, ' ').trim();
      const link = (item.link || '').trim();
      if (title.length < 12 || !link) continue;
      if (inc && !inc.test(title)) continue;
      if (exc && exc.test(title)) continue;
      if (seen.has(link)) continue;
      seen.add(link);

      out.push({
        title,
        sourceUrl: link,
        publishedDate: parseIndianDate(item.isoDate || item.pubDate),
        noticeType: classifyNoticeType(title) ?? fallback,
        rawFields: {
          summary: (item.contentSnippet || item.content || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500),
        },
      });
    }

    return out.slice(0, this.http.maxItems);
  }
}
