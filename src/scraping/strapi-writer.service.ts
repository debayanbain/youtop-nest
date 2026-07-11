import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin writer over the Strapi Content API (authenticated with
 * STRAPI_API_TOKEN). Used only by the scraper — creates UNPUBLISHED drafts and
 * dedupes by `source_meta.source_url`. Reads/mutations here bypass
 * StrapiService's cache on purpose (freshness matters for dedup).
 */
@Injectable()
export class StrapiWriterService {
  private readonly logger = new Logger(StrapiWriterService.name);
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('STRAPI_URL') || 'http://localhost:4040'
    ).replace(/\/$/, '');
    this.apiToken = this.config.get<string>('STRAPI_API_TOKEN') || '';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  /** True if an entry already exists for this source URL (draft OR published). */
  async existsBySourceUrl(
    pluralApiId: string,
    sourceUrl: string,
  ): Promise<boolean> {
    const base =
      `filters[source_meta][source_url][$eq]=${encodeURIComponent(sourceUrl)}` +
      `&pagination[pageSize]=1&fields[0]=id`;
    for (const status of ['published', 'draft']) {
      const url = `${this.baseUrl}/api/${pluralApiId}?${base}&status=${status}`;
      try {
        const res = await fetch(url, { headers: this.headers() });
        if (res.ok) {
          const json = (await res.json()) as { data?: unknown[] };
          if (Array.isArray(json.data) && json.data.length > 0) return true;
        }
      } catch (err) {
        this.logger.warn(
          `Dedup check failed for ${pluralApiId}: ${(err as Error).message}`,
        );
      }
    }
    return false;
  }

  /** Create a DRAFT entry (Strapi v5 create is unpublished by default). */
  async createDraft(
    pluralApiId: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    const url = `${this.baseUrl}/api/${pluralApiId}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(
          `Create ${pluralApiId} failed (${res.status}): ${body.slice(0, 200)}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Create ${pluralApiId} error: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
