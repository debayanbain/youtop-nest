import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { NOTICE_TYPES, NoticeType, isNoticeType } from '../notice-type';

export interface EnrichInput {
  title: string;
  description?: string;
  organisation?: string;
  category?: string;
}

export interface EnrichOutput {
  seoDescription?: string;
  seoKeywords?: string;
  excerpt?: string;
}

/**
 * Optional AI-SEO enrichment for scraped notices. Gated by AI_ENRICH_ENABLED +
 * ANTHROPIC_API_KEY — a no-op returning {} when either is unset, so the scrape
 * pipeline never depends on it. Uses Claude Haiku (cheap) and treats the model
 * output as untrusted: JSON is validated, lengths capped, and the scraped facts
 * (title, dates, links) are NOT rewritten — only SEO metadata is generated.
 */
@Injectable()
export class AiEnrichmentService {
  private readonly logger = new Logger(AiEnrichmentService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const on =
      String(this.config.get('AI_ENRICH_ENABLED') ?? 'false') === 'true';
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model =
      this.config.get<string>('AI_ENRICH_MODEL') || 'claude-haiku-4-5';
    this.client = on && key ? new Anthropic({ apiKey: key }) : null;
    if (on && !key) {
      this.logger.warn(
        'AI_ENRICH_ENABLED but ANTHROPIC_API_KEY missing — disabled.',
      );
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async enrich(input: EnrichInput): Promise<EnrichOutput> {
    if (!this.client) return {};
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        system:
          'You write SEO metadata for an Indian government jobs/results aggregator. ' +
          'Use only the facts in the input — never invent dates, numbers, or organisations. ' +
          'Reply with ONLY a minified JSON object of the exact shape ' +
          '{"seoDescription":"...","seoKeywords":"...","excerpt":"..."} — no prose, no code fences. ' +
          'seoDescription: <=160 chars. seoKeywords: 5-8 comma-separated terms. excerpt: 1-2 plain sentences.',
        messages: [
          {
            role: 'user',
            content:
              `Title: ${input.title}\n` +
              `Organisation: ${input.organisation ?? ''}\n` +
              `Type: ${input.category ?? ''}\n` +
              `Summary: ${(input.description ?? '').slice(0, 800)}`,
          },
        ],
      });

      const block = res.content.find((b) => b.type === 'text');
      const raw = block && block.type === 'text' ? block.text : '';
      const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const str = (v: unknown, max: number) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
      return {
        seoDescription: str(parsed.seoDescription, 200),
        seoKeywords: str(parsed.seoKeywords, 300),
        excerpt: str(parsed.excerpt, 500),
      };
    } catch (err) {
      this.logger.warn(`enrich failed: ${(err as Error).message}`);
      return {};
    }
  }

  /**
   * Classify a notice title into a NoticeType — the AI FALLBACK used only when
   * the in-scraper heuristic returned null (see NoticeClassifierService). Reuses
   * the same Claude Haiku client. Returns 'notification' on any failure/disabled
   * so classification never blocks ingest. The model output is validated against
   * the enum; anything unexpected falls back to 'notification'.
   */
  async classifyNoticeType(title: string): Promise<NoticeType> {
    if (!this.client) return 'notification';
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 12,
        system:
          'You classify Indian government notice titles. Reply with EXACTLY one ' +
          `of these tokens and nothing else: ${NOTICE_TYPES.join(', ')}. ` +
          'Use "notification" if unsure.',
        messages: [{ role: 'user', content: title.slice(0, 300) }],
      });
      const block = res.content.find((b) => b.type === 'text');
      const raw = block && block.type === 'text' ? block.text : '';
      const token = raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z_]/g, '');
      return isNoticeType(token) ? token : 'notification';
    } catch (err) {
      this.logger.warn(`classifyNoticeType failed: ${(err as Error).message}`);
      return 'notification';
    }
  }
}
