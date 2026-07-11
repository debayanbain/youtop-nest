import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import robotsParser from 'robots-parser';
import { StrapiWriterService } from './strapi-writer.service';
import {
  SCRAPE_SOURCES,
  ScrapeSource,
  ScrapeContentType,
} from './sources.registry';

interface ScrapedItem {
  title: string;
  link: string;
  date?: string;
  summary?: string;
  image?: string;
}

export interface ScrapeResult {
  source: string;
  created: number;
  skipped: number;
  error?: string;
}

/** contentType -> Strapi pluralName (REST path). */
const PLURAL: Record<ScrapeContentType, string> = {
  'job-result': 'job-results',
  scholarship: 'scholarships',
  'job-news': 'job-news-items',
};

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly rss = new Parser();
  private readonly userAgent: string;
  private readonly delayMs: number;
  private readonly maxItems: number;

  constructor(
    private readonly config: ConfigService,
    private readonly writer: StrapiWriterService,
  ) {
    this.userAgent =
      this.config.get<string>('SCRAPER_USER_AGENT') ||
      'YouTOPBot/1.0 (+https://youtop.local/bot)';
    this.delayMs = Number(this.config.get('SCRAPER_DELAY_MS') ?? 1500);
    // Cap items written per source per run so a feed of hundreds doesn't flood
    // Strapi with drafts. Newest first (feeds are already reverse-chronological).
    this.maxItems = Number(this.config.get('SCRAPER_MAX_ITEMS') ?? 25);
  }

  /** Run every enabled source, politely spaced out. Errors are isolated. */
  async scrapeAll(): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    for (const source of SCRAPE_SOURCES.filter((s) => s.enabled)) {
      results.push(await this.scrapeSource(source));
      await this.sleep(this.delayMs);
    }
    return results;
  }

  async scrapeSourceByKey(key: string): Promise<ScrapeResult> {
    const source = SCRAPE_SOURCES.find((s) => s.key === key);
    if (!source) throw new Error(`Unknown scrape source: ${key}`);
    return this.scrapeSource(source);
  }

  private async scrapeSource(source: ScrapeSource): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: source.key, created: 0, skipped: 0 };
    try {
      // A published RSS feed is opt-in syndication, so robots.txt (a crawler
      // directive) only gates HTML page scraping.
      if (source.mode === 'html' && !(await this.allowedByRobots(source.url))) {
        result.error = 'blocked by robots.txt';
        this.logger.warn(`[${source.key}] blocked by robots.txt`);
        return result;
      }

      const items =
        source.mode === 'rss'
          ? await this.parseRss(source)
          : await this.parseHtml(source);

      const plural = PLURAL[source.contentType];
      for (const item of items.slice(0, this.maxItems)) {
        if (!item.title || !item.link) {
          result.skipped++;
          continue;
        }
        if (await this.writer.existsBySourceUrl(plural, item.link)) {
          result.skipped++;
          continue;
        }
        const ok = await this.writer.createDraft(
          plural,
          this.toEntry(source, item),
        );
        if (ok) result.created++;
        else result.skipped++;
      }
      this.logger.log(
        `[${source.key}] created=${result.created} skipped=${result.skipped}`,
      );
    } catch (err) {
      result.error = (err as Error).message;
      this.logger.error(`[${source.key}] scrape failed: ${result.error}`);
    }
    return result;
  }

  private async parseRss(source: ScrapeSource): Promise<ScrapedItem[]> {
    const feed = await this.rss.parseURL(source.url);
    return (feed.items || []).map((it) => ({
      title: (it.title || '').trim(),
      link: (it.link || '').trim(),
      date: it.isoDate || it.pubDate,
      summary: (it.contentSnippet || it.content || '').trim().slice(0, 500),
      image: it.enclosure?.url,
    }));
  }

  private async parseHtml(source: ScrapeSource): Promise<ScrapedItem[]> {
    const html = await this.fetchText(source.url);
    const $ = cheerio.load(html);
    const origin = new URL(source.url).origin;
    const f = source.fields || {};
    const out: ScrapedItem[] = [];

    $(source.itemSelector || 'article').each((_, el) => {
      const node = $(el);
      const pick = (sel?: string) => (sel ? node.find(sel).first() : node);

      const title = (f.title ? pick(f.title).text() : node.text()).trim();
      if (!title) return;

      let link = pick(f.link).attr('href') || '';
      if (link.startsWith('/')) link = origin + link;

      const date = f.date ? pick(f.date).text().trim() : undefined;
      const summary = f.summary
        ? pick(f.summary).text().trim().slice(0, 500)
        : undefined;
      let image = f.image ? pick(f.image).attr('src') : undefined;
      if (image && image.startsWith('/')) image = origin + image;

      out.push({ title, link, date, summary, image });
    });

    return out;
  }

  /** Map a normalized item to the target content type's draft payload. */
  private toEntry(
    source: ScrapeSource,
    item: ScrapedItem,
  ): Record<string, unknown> {
    const source_meta = {
      source_type: 'scraped',
      source_url: item.link,
      source_name: source.sourceName || source.key,
      scraped_at: new Date().toISOString(),
    };
    const slug = `${this.slugify(item.title)}-${this.shortHash(item.link)}`;
    const date = this.toIsoDate(item.date);

    switch (source.contentType) {
      case 'job-result':
        return {
          title: item.title,
          slug,
          official_link: item.link,
          result_date: date,
          description: item.summary,
          active: true,
          source_meta,
        };
      case 'scholarship':
        return {
          title: item.title,
          slug,
          application_link: item.link,
          description: item.summary,
          deadline: date,
          status: 'Live',
          active: true,
          source_meta,
        };
      case 'job-news':
        return {
          title: item.title,
          slug,
          source_link: item.link,
          summary: item.summary,
          published_date: date,
          category: source.newsCategory ?? 'job',
          active: true,
          source_meta,
        };
    }
  }

  private async allowedByRobots(targetUrl: string): Promise<boolean> {
    try {
      const robotsUrl = `${new URL(targetUrl).origin}/robots.txt`;
      const res = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.userAgent },
      });
      if (!res.ok) return true; // no robots.txt -> allowed
      const robots = robotsParser(robotsUrl, await res.text());
      // undefined (no matching rule) -> allowed; only an explicit false blocks.
      return robots.isAllowed(targetUrl, this.userAgent) !== false;
    } catch {
      return true;
    }
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent },
    });
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
    return res.text();
  }

  private toIsoDate(d?: string): string | undefined {
    if (!d) return undefined;
    const t = new Date(d);
    return isNaN(t.getTime()) ? undefined : t.toISOString().slice(0, 10);
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

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
