import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { ScrapedResult, NoticeCategory } from './scraped-result.interface';

/**
 * One scraper per source (one official website). Implementations only know how
 * to turn their own site into ScrapedResult[]; the orchestrator handles
 * normalize/dedup/publish/record. Keep `key` stable — it identifies the source
 * in admin triggers, scheduling, and the scrape_jobs monitor.
 */
export interface SourceScraper {
  readonly key: string;
  readonly displayName: string;
  readonly enabled: boolean;
  /** Optional per-source schedule override (ms); falls back to the global one. */
  readonly scheduleMs?: number;
  fetch(): Promise<ScrapedResult[]>;
}

const UA = 'YouTOPBot/1.0 (+https://youtop.local/bot)';

/**
 * Shared HTTP + parsing helpers for HTML scrapers: robots-aware fetch, cheerio
 * load, URL absolutization, date parsing, and keyword→category classification.
 */
export abstract class BaseScraper implements SourceScraper {
  abstract readonly key: string;
  abstract readonly displayName: string;
  readonly enabled: boolean = true;
  readonly scheduleMs?: number;

  abstract fetch(): Promise<ScrapedResult[]>;

  protected async loadHtml(url: string): Promise<cheerio.CheerioAPI> {
    if (!(await this.allowedByRobots(url))) {
      throw new Error(`blocked by robots.txt: ${url}`);
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
    return cheerio.load(await res.text());
  }

  protected absolute(href: string, base: string): string {
    try {
      return new URL(href, base).toString();
    } catch {
      return href;
    }
  }

  protected toIso(raw?: string): string | undefined {
    if (!raw) return undefined;
    const s = raw.trim();
    const dmy = s.match(/(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{4})/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const t = new Date(s);
    return isNaN(t.getTime()) ? undefined : t.toISOString().slice(0, 10);
  }

  /** Classify a notice title into a NoticeCategory by keyword. */
  protected classify(title: string): NoticeCategory {
    const t = title.toLowerCase();
    if (/answer\s*key/.test(t)) return 'answer-key';
    if (/admit\s*card|hall\s*ticket|e-?admit/.test(t)) return 'admit-card';
    if (/merit\s*list/.test(t)) return 'merit-list';
    if (/counsell?ing/.test(t)) return 'counseling';
    if (/cut.?off/.test(t)) return 'cutoff';
    if (/final\s*result/.test(t)) return 'final-result';
    if (/result|marks|score\s*card|selected|shortlist/.test(t)) return 'result';
    if (/scholarship/.test(t)) return 'scholarship';
    if (
      /recruit|vacanc|advertisement|advt|apply online|online form|notification of|posts?\b|bharti/.test(
        t,
      )
    )
      return 'job';
    return 'notification';
  }

  private async allowedByRobots(target: string): Promise<boolean> {
    try {
      const robotsUrl = `${new URL(target).origin}/robots.txt`;
      const res = await fetch(robotsUrl, { headers: { 'User-Agent': UA } });
      if (!res.ok) return true; // no robots.txt -> allowed
      const robots = robotsParser(robotsUrl, await res.text());
      return robots.isAllowed(target, UA) !== false;
    } catch {
      return true;
    }
  }
}
