import type { NoticeType } from '../notice-type';
import type { SourceConfig } from '../sources/notice-source.registry';

/**
 * The single shape every notice scraper returns. Scrapers know nothing about
 * Postgres or dedupe — the orchestrator (NoticeIngestService) computes the
 * dedupe_hash, runs the classifier fallback, enriches, and upserts. `rawFields`
 * carries anything source-specific (advt no, vacancies, fee, last date, ...);
 * only the first-class columns come from the typed fields here.
 */
export interface RawNotice {
  title: string;
  sourceUrl: string;
  /** ISO 'YYYY-MM-DD' if parseable, else undefined. */
  publishedDate?: string;
  /** Heuristic classification done in-scraper (null when nothing matched). */
  noticeType: NoticeType | null;
  rawFields: Record<string, unknown>;
}

/**
 * One class per source. No shared config-driven selector base — each scraper
 * owns its own markup knowledge (see the build spec's "what not to do"). Shared
 * HTTP/robots/retry lives in ScraperHttpService; shared date + keyword logic in
 * the scraper utils — those are helpers, not a magic abstraction.
 */
export interface NoticeScraper {
  /** Stable class identifier, matched against SourceConfig.scraperClass. */
  readonly scraperClass: string;
  /**
   * Receives the resolved SourceConfig so one scraper class can serve many
   * registry rows (e.g. a single RssNoticeScraper drives every RSS feed by
   * `source.url`). HTML scrapers may ignore it and use their own hard-coded
   * base.
   */
  scrape(source: SourceConfig): Promise<RawNotice[]>;
}
