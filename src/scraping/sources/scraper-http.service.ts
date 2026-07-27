import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';

/**
 * Shared HTTP layer for the notices pipeline scrapers: config-driven User-Agent
 * (SCRAPER_USER_AGENT), retry-with-backoff for cold-start/transient timeouts
 * (the same 3-attempt pattern StrapiService uses internally — reproduced here
 * because that one is private), robots.txt gating for HTML page scraping, and
 * cheerio loading. Scrapers own their own selectors; this owns transport only,
 * so it's a helper, not the forbidden config-driven selector abstraction.
 *
 * Security: every target URL is a hard-coded value from the source registry
 * (never user input), so there is no SSRF surface. We still restrict to
 * http(s) and never log query strings (data.gov api-key hygiene).
 */
@Injectable()
export class ScraperHttpService {
  private readonly logger = new Logger(ScraperHttpService.name);
  readonly userAgent: string;
  readonly maxItems: number;
  readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly attempts = 3;

  constructor(private readonly config: ConfigService) {
    this.userAgent =
      this.config.get<string>('SCRAPER_USER_AGENT') ||
      'YouTOPBot/1.0 (+https://youtop.local/bot)';
    this.maxItems = Number(this.config.get('SCRAPER_MAX_ITEMS') ?? 25);
    this.delayMs = Number(this.config.get('SCRAPER_DELAY_MS') ?? 1500);
    this.timeoutMs = Number(this.config.get('SCRAPER_TIMEOUT_MS') ?? 30000);
  }

  private assertHttp(url: string): void {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error(`refusing non-http(s) URL: ${u.protocol}`);
    }
  }

  /** Redact the query string so a data.gov api-key never reaches the logs. */
  private safe(url: string): string {
    return url.split('?')[0];
  }

  private async fetchWithRetry(url: string, accept: string): Promise<Response> {
    this.assertHttp(url);
    let lastErr: unknown;
    for (let i = 0; i < this.attempts; i++) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': this.userAgent, Accept: accept },
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: 'follow',
        });
        if (!res.ok) throw new Error(`${this.safe(url)} -> ${res.status}`);
        return res;
      } catch (err) {
        lastErr = err;
        if (i < this.attempts - 1) {
          await this.sleep(500 * Math.pow(2, i)); // 0.5s, 1s backoff
        }
      }
    }
    throw new Error(
      `fetch failed after ${this.attempts} attempts: ${(lastErr as Error).message}`,
    );
  }

  async fetchText(url: string): Promise<string> {
    const res = await this.fetchWithRetry(
      url,
      'text/html,application/xhtml+xml',
    );
    return res.text();
  }

  async fetchJson<T = Record<string, unknown>>(url: string): Promise<T> {
    const res = await this.fetchWithRetry(url, 'application/json');
    return (await res.json()) as T;
  }

  /** robots-aware cheerio load for HTML notice boards. */
  async loadHtml(url: string): Promise<cheerio.CheerioAPI> {
    if (!(await this.allowedByRobots(url))) {
      throw new Error(`blocked by robots.txt: ${this.safe(url)}`);
    }
    return cheerio.load(await this.fetchText(url));
  }

  /** Absolutize a possibly-relative href against a base URL. */
  absolute(href: string, base: string): string {
    try {
      return new URL(href, base).toString();
    } catch {
      return href;
    }
  }

  async allowedByRobots(target: string): Promise<boolean> {
    try {
      const robotsUrl = `${new URL(target).origin}/robots.txt`;
      const res = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return true; // no robots.txt -> allowed
      const robots = robotsParser(robotsUrl, await res.text());
      // Only an explicit disallow blocks; unknown (undefined) -> allowed.
      return robots.isAllowed(target, this.userAgent) !== false;
    } catch {
      return true;
    }
  }

  sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
