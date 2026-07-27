import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NoticeScraper,
  RawNotice,
} from '../interfaces/notice-scraper.interface';
import type { SourceConfig } from '../sources/notice-source.registry';
import { ScraperHttpService } from '../sources/scraper-http.service';
import { mapDataGovRecord } from '../data-gov.mapper';
import { classifyNoticeType } from '../utils/classify-notice-type.util';
import { parseIndianDate } from '../utils/parse-indian-date.util';

/**
 * data.gov.in — National Career Service open-data job vacancies (tier 'api').
 * A no-op that returns [] until BOTH DATA_GOV_API_KEY and
 * DATA_GOV_NCS_RESOURCE_ID are set, so it can be scheduled safely alongside the
 * HTML sources. Reuses the existing `mapDataGovRecord` alias-probing mapper.
 * The api-key is never logged (ScraperHttpService redacts query strings).
 */
@Injectable()
export class DataGovNcsScraper implements NoticeScraper {
  readonly scraperClass = 'DataGovNcsScraper';
  private readonly logger = new Logger(DataGovNcsScraper.name);
  private readonly template =
    'https://api.data.gov.in/resource/{RESOURCE_ID}?api-key={API_KEY}&format=json&limit=50';

  constructor(
    private readonly http: ScraperHttpService,
    private readonly config: ConfigService,
  ) {}

  async scrape(_source: SourceConfig): Promise<RawNotice[]> {
    const key = this.config.get<string>('DATA_GOV_API_KEY') || '';
    const resource = this.config.get<string>('DATA_GOV_NCS_RESOURCE_ID') || '';
    if (!key || !resource) {
      this.logger.log(
        'data.gov.in NCS not configured (DATA_GOV_API_KEY / DATA_GOV_NCS_RESOURCE_ID) — skipping.',
      );
      return [];
    }

    const url = this.template
      .replace('{RESOURCE_ID}', encodeURIComponent(resource))
      .replace('{API_KEY}', encodeURIComponent(key));

    const json = await this.http.fetchJson<{
      records?: Record<string, unknown>[];
    }>(url);
    const records = Array.isArray(json.records) ? json.records : [];
    const out: RawNotice[] = [];
    const seen = new Set<string>();

    for (const rec of records) {
      const item = mapDataGovRecord(rec);
      if (!item) continue;
      if (seen.has(item.link)) continue;
      seen.add(item.link);

      out.push({
        title: item.title,
        sourceUrl: item.link,
        publishedDate: parseIndianDate(item.date),
        // NCS is a jobs dataset; fall back to the heuristic then 'job'.
        noticeType: classifyNoticeType(item.title) ?? 'job',
        rawFields: { summary: item.summary },
      });
    }

    return out.slice(0, this.http.maxItems);
  }
}
