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
 * Railway Recruitment Board (Mumbai) — rrbmumbai.gov.in is static HTML. Notices
 * are ordinary anchors to per-CEN `.php` pages (e.g. `CEN01-2025.php` "CEN 01/
 * 2025 -- ALP POSTS", `Result-2025.php`). Anchor text carries a trailing
 * "Click to know Update" call-to-action that we strip. A small nav denylist
 * drops the fixed menu links that also end in `.php`.
 *
 * (RRBs are regional; the national rrbcdg.gov.in host has a broken TLS cert, so
 * Mumbai is used as the representative board — swap the base to add more.)
 */
@Injectable()
export class RrbScraper implements NoticeScraper {
  readonly scraperClass = 'RrbScraper';
  private readonly base = 'https://rrbmumbai.gov.in/';
  private readonly navDenylist = new Set([
    'selection_procedure.php',
    'pubdisc.php',
    'download-forms.php',
    'index.php',
    'home.php',
    'contact.php',
    'contactus.php',
    'rti.php',
    'faq.php',
  ]);

  constructor(private readonly http: ScraperHttpService) {}

  async scrape(_source: SourceConfig): Promise<RawNotice[]> {
    const $ = await this.http.loadHtml(this.base);
    const out: RawNotice[] = [];
    const seen = new Set<string>();

    $('a[href$=".php"], a[href$=".PHP"]').each((_, a) => {
      const href = ($(a).attr('href') || '').trim();
      const base = href.split('/').pop()?.toLowerCase() || '';
      if (!href || this.navDenylist.has(base)) return;

      const title = $(a)
        .text()
        .replace(/click to know update/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (title.length < 12) return;

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
