import { Injectable } from '@nestjs/common';
import { ScrapedResult } from '../interfaces/scraped-result.interface';

export interface NormalizedEntry {
  /** Strapi pluralName REST path. */
  plural: string;
  /** Strapi entry payload. */
  entry: Record<string, unknown>;
  /** Dedup key (source URL). */
  sourceUrl: string;
}

/**
 * Maps a source-agnostic ScrapedResult onto the correct existing Strapi content
 * type. Routing by `category`:
 *   job                       -> job-news  (is_posting=true)
 *   scholarship               -> scholarship
 *   result/admit-card/...     -> job-result (kind = the category)
 * Keeps the 3 separate content types (no unified Notice collection).
 */
@Injectable()
export class NormalizerService {
  normalize(r: ScrapedResult): NormalizedEntry {
    const sourceUrl = r.url;
    const source_meta = {
      source_type: 'scraped',
      source_url: sourceUrl,
      source_name: r.organisation || 'scraped',
      scraped_at: new Date().toISOString(),
    };
    const slug = `${this.slugify(r.title)}-${this.shortHash(sourceUrl)}`;
    const tags = r.tags?.length ? r.tags.join(', ') : undefined;

    if (r.category === 'job') {
      return {
        plural: 'job-news-items',
        sourceUrl,
        entry: {
          title: r.title,
          slug,
          source_link: sourceUrl,
          summary: r.description,
          published_date: r.publishedAt,
          category: 'job',
          is_posting: true,
          organization: r.organisation,
          vacancies: r.vacancies,
          qualification: r.qualification,
          eligibility: r.eligibility,
          last_date: r.lastDate,
          apply_link: r.applyLink,
          notification_link: r.notificationPdf,
          official_website: r.url,
          tags,
          active: true,
          source_meta,
        },
      };
    }

    if (r.category === 'scholarship') {
      return {
        plural: 'scholarships',
        sourceUrl,
        entry: {
          title: r.title,
          slug,
          application_link: r.applyLink || sourceUrl,
          description: r.description,
          deadline: r.lastDate,
          status: 'Live',
          provider: r.organisation,
          active: true,
          source_meta,
        },
      };
    }

    // Everything else -> job-result, with `kind` carrying the exact category.
    return {
      plural: 'job-results',
      sourceUrl,
      entry: {
        title: r.title,
        slug,
        kind: r.category, // result | admit-card | answer-key | ... | notification
        organization: r.organisation,
        result_date: r.resultDate || r.publishedAt,
        description: r.description,
        official_link: r.notificationPdf || sourceUrl,
        tags,
        active: true,
        source_meta,
      },
    };
  }

  private slugify(s: string): string {
    return (
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80) || 'item'
    );
  }

  private shortHash(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36).slice(0, 6);
  }
}
