import { Injectable } from '@nestjs/common';
import {
  NoticeScraper,
  RawNotice,
} from '../interfaces/notice-scraper.interface';
import type { SourceConfig } from '../sources/notice-source.registry';
import { ScraperHttpService } from '../sources/scraper-http.service';
import { classifyNoticeType } from '../utils/classify-notice-type.util';
import { parseIndianDate } from '../utils/parse-indian-date.util';

interface SscAttachment {
  fileName?: string;
  path?: string;
  type?: string;
}
interface SscRecord {
  id?: string;
  headline?: string;
  examId?: string;
  redirectUrl?: string;
  createdAt?: string;
  attachments?: SscAttachment[];
}
interface SscResponse {
  statusCode?: string;
  data?: SscRecord[];
}

/**
 * SSC — ssc.gov.in is an Angular SPA (no notices in the raw HTML), but its
 * public portal exposes the notice board as JSON at
 * `/api/general-website/portal/records?contentType=notice-boards`. Endpoint +
 * param schema were confirmed live. No auth needed. Notice PDFs download
 * through an authenticated admin route, so sourceUrl falls back to a stable
 * per-record portal link; the raw attachment path is kept in rawFields.
 */
@Injectable()
export class SscScraper implements NoticeScraper {
  readonly scraperClass = 'SscScraper';
  private readonly origin = 'https://ssc.gov.in';
  private readonly endpoint =
    'https://ssc.gov.in/api/general-website/portal/records';

  constructor(private readonly http: ScraperHttpService) {}

  private buildUrl(): string {
    const params = new URLSearchParams({
      contentType: 'notice-boards',
      page: '1',
      limit: String(this.http.maxItems),
      key: 'createdAt',
      order: 'DESC',
      isPaginationRequired: 'true',
      isAttachment: 'true',
      language: 'english',
      attributes:
        'id,headline,contentType,startDate,endDate,language,createdAt',
    });
    return `${this.endpoint}?${params.toString()}`;
  }

  async scrape(_source: SourceConfig): Promise<RawNotice[]> {
    const json = await this.http.fetchJson<SscResponse>(this.buildUrl());
    const records = Array.isArray(json.data) ? json.data : [];
    const out: RawNotice[] = [];
    const seen = new Set<string>();

    for (const rec of records) {
      const title = (rec.headline || '').replace(/\s+/g, ' ').trim();
      if (title.length < 8) continue;

      const redirect = (rec.redirectUrl || '').trim();
      const sourceUrl = redirect
        ? this.http.absolute(redirect, this.origin)
        : `${this.origin}/notice-board?id=${encodeURIComponent(rec.id || title)}`;
      if (seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);

      out.push({
        title,
        sourceUrl,
        publishedDate: parseIndianDate(rec.createdAt),
        noticeType: classifyNoticeType(title),
        rawFields: {
          id: rec.id,
          examId: rec.examId,
          redirectUrl: redirect || undefined,
          createdAt: rec.createdAt,
          attachments: (rec.attachments || []).map((a) => ({
            fileName: a.fileName,
            path: a.path,
          })),
        },
      });
    }

    return out.slice(0, this.http.maxItems);
  }
}
