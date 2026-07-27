import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PostgresService } from '../../core/database/postgres.service';
import { RawNotice } from '../interfaces/notice-scraper.interface';
import { NoticeType } from '../notice-type';
import { NoticeClassifierService } from './notice-classifier.service';
import { AiEnrichmentService } from '../enrich/ai-enrichment.service';

export interface IngestOutcome {
  inserted: boolean;
}

/**
 * Turns a scraper's RawNotice into a `notices` row. Owns the parts scrapers must
 * NOT know about: dedupe_hash, the classification fallback, the idempotent
 * insert, and optional SEO enrichment.
 *
 * SEO enrichment (Phase 5) runs for ALL sources uniformly, gated by
 * AI_ENRICH_ENABLED, and only for rows we actually insert (never re-spent on
 * duplicates). It only ADDS seo_description / seo_keywords — the scraped title,
 * dates, url, and type are never rewritten.
 *
 * Security: every value is parameterized (named replacements / ORM), never
 * concatenated into SQL. raw_fields is cast to jsonb from a stringified value.
 */
@Injectable()
export class NoticeIngestService {
  private readonly logger = new Logger(NoticeIngestService.name);

  constructor(
    private readonly db: PostgresService,
    private readonly classifier: NoticeClassifierService,
    private readonly enricher: AiEnrichmentService,
  ) {}

  /** sha256(source_id + '|' + title.trim().toLowerCase() + '|' + source_url). */
  private dedupeHash(
    sourceId: string,
    title: string,
    sourceUrl: string,
  ): string {
    return createHash('sha256')
      .update(`${sourceId}|${title.trim().toLowerCase()}|${sourceUrl}`)
      .digest('hex');
  }

  async upsert(
    sourceId: string,
    orgName: string,
    raw: RawNotice,
  ): Promise<IngestOutcome> {
    const title = raw.title.replace(/\s+/g, ' ').trim();
    if (!title || !raw.sourceUrl) return { inserted: false };

    const dedupeHash = this.dedupeHash(sourceId, title, raw.sourceUrl);
    // Heuristic first (already run in-scraper), AI only for the null residual.
    const noticeType: NoticeType = await this.classifier.classify(
      title,
      raw.noticeType,
    );

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO notices
         (source_id, notice_type, title, org_name, source_url, published_date, dedupe_hash, raw_fields)
       VALUES
         (:sourceId, :noticeType, :title, :orgName, :sourceUrl, :publishedDate, :dedupeHash, CAST(:rawFields AS jsonb))
       ON CONFLICT (dedupe_hash) DO NOTHING
       RETURNING id`,
      {
        sourceId,
        noticeType,
        title,
        orgName,
        sourceUrl: raw.sourceUrl,
        publishedDate: raw.publishedDate ?? null,
        dedupeHash,
        rawFields: JSON.stringify(raw.rawFields ?? {}),
      },
    );

    const insertedId = result.rows[0]?.id;
    if (!insertedId) return { inserted: false };

    // Additive SEO metadata only for freshly-inserted rows.
    if (this.enricher.isEnabled) {
      await this.enrichSeo(insertedId, title, orgName, noticeType);
    }
    return { inserted: true };
  }

  private async enrichSeo(
    id: string,
    title: string,
    orgName: string,
    noticeType: NoticeType,
  ): Promise<void> {
    try {
      const seo = await this.enricher.enrich({
        title,
        organisation: orgName,
        category: noticeType,
      });
      const patch: Record<string, unknown> = {};
      if (seo.seoDescription) patch.seoDescription = seo.seoDescription;
      if (seo.seoKeywords) {
        const kws = seo.seoKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
        if (kws.length) patch.seoKeywords = kws;
      }
      if (Object.keys(patch).length) {
        // ORM update handles the TEXT[] mapping and parameterization; only SEO
        // columns are touched — scraped facts are untouched.
        await this.db.models.Notice.update(patch, { where: { id } });
      }
    } catch (err) {
      this.logger.warn(
        `SEO enrich failed for ${id}: ${(err as Error).message}`,
      );
    }
  }
}
