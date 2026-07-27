import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiEnrichmentService } from '../enrich/ai-enrichment.service';
import { NoticeType } from '../notice-type';

/**
 * Decides a notice's final type. The in-scraper keyword heuristic runs first and
 * catches ~85% (spec Phase 5); Claude is only consulted for the residual — never
 * per notice — to keep Haiku spend negligible at 4 sources × every 30 min. When
 * the heuristic is null and AI is disabled, we default to 'notification'.
 */
@Injectable()
export class NoticeClassifierService {
  constructor(
    private readonly config: ConfigService,
    private readonly ai: AiEnrichmentService,
  ) {}

  async classify(
    title: string,
    heuristicResult: NoticeType | null,
  ): Promise<NoticeType> {
    if (heuristicResult) return heuristicResult;
    if (String(this.config.get('AI_ENRICH_ENABLED') ?? 'false') !== 'true') {
      return 'notification';
    }
    return this.ai.classifyNoticeType(title);
  }
}
