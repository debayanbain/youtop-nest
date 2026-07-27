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
import { mapDataGovRecord } from './data-gov.mapper';
import { parseFreejobalert, JobPostingDetails } from './job-detail.parser';
import { ScrapeJobRecorder } from './monitor/scrape-job-recorder.service';
import { NormalizerService } from './normalize/normalizer.service';
import { AiEnrichmentService } from './enrich/ai-enrichment.service';
import { CacheService } from '../core/cache/cache.service';
import { SOURCE_SCRAPERS } from './sources/source-scraper.registry';
import { SourceScraper } from './interfaces/source-scraper.interface';

interface ScrapedItem {
  title: string;
  link: string;
  date?: string;
  summary?: string;
  image?: string;
  details?: JobPostingDetails;
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
    private readonly recorder: ScrapeJobRecorder,
    private readonly normalizer: NormalizerService,
    private readonly enricher: AiEnrichmentService,
    private readonly cache: CacheService,
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
    // Modular official-site scrapers first, then legacy RSS/HTML/api sources.
    for (const scraper of SOURCE_SCRAPERS.filter((s) => s.enabled)) {
      results.push(await this.runSourceScraper(scraper));
      await this.sleep(this.delayMs);
    }
    for (const source of SCRAPE_SOURCES.filter((s) => s.enabled)) {
      results.push(await this.scrapeSource(source));
      await this.sleep(this.delayMs);
    }
    return results;
  }

  async scrapeSourceByKey(key: string): Promise<ScrapeResult> {
    const modular = SOURCE_SCRAPERS.find((s) => s.key === key);
    if (modular) return this.runSourceScraper(modular);
    const source = SCRAPE_SOURCES.find((s) => s.key === key);
    if (!source) throw new Error(`Unknown scrape source: ${key}`);
    return this.scrapeSource(source);
  }

  /**
   * New pipeline: a SourceScraper yields ScrapedResult[]; we normalize each to
   * the right Strapi type, dedup by source_url, publish, count, and record the
   * run. Cache is cleared once at the end if anything was written.
   */
  private async runSourceScraper(
    scraper: SourceScraper,
  ): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      source: scraper.key,
      created: 0,
      skipped: 0,
    };
    const startedAt = Date.now();
    const jobId = await this.recorder.start(scraper.key);
    try {
      const items = await scraper.fetch();
      for (const item of items.slice(0, this.maxItems)) {
        if (!item.title || !item.url) {
          result.skipped++;
          continue;
        }
        const { plural, entry, sourceUrl } = this.normalizer.normalize(item);
        if (await this.writer.existsBySourceUrl(plural, sourceUrl)) {
          result.skipped++;
          continue;
        }
        // Optional AI-SEO enrichment (only for items we'll actually write).
        if (this.enricher.isEnabled) {
          const seo = await this.enricher.enrich({
            title: item.title,
            description: item.description,
            organisation: item.organisation,
            category: item.category,
          });
          if (seo.seoDescription) entry.seo_description = seo.seoDescription;
          if (seo.seoKeywords) entry.seo_keywords = seo.seoKeywords;
          if (seo.excerpt) {
            if (plural === 'job-news-items' && !entry.summary)
              entry.summary = seo.excerpt;
            else if (!entry.description) entry.description = seo.excerpt;
          }
        }
        const ok = await this.writer.createDraft(plural, entry);
        if (ok) result.created++;
        else result.skipped++;
      }
      if (result.created > 0) await this.cache.delPattern('strapi:*');
      this.logger.log(
        `[${scraper.key}] created=${result.created} skipped=${result.skipped}`,
      );
    } catch (err) {
      result.error = (err as Error).message;
      this.logger.error(`[${scraper.key}] scrape failed: ${result.error}`);
    } finally {
      await this.recorder.finish(jobId, {
        status: result.error ? 'error' : 'success',
        itemsFound: result.created + result.skipped,
        itemsInserted: result.created,
        itemsSkipped: result.skipped,
        durationMs: Date.now() - startedAt,
        error: result.error ?? null,
      });
    }
    return result;
  }

  private async scrapeSource(source: ScrapeSource): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: source.key, created: 0, skipped: 0 };
    const startedAt = Date.now();
    const jobId = await this.recorder.start(source.key);
    try {
      // API mode: resolve the {API_KEY}/{RESOURCE_ID} template from env. Skip
      // (not an error worth alerting on) when the source isn't configured yet.
      let effectiveUrl = source.url;
      if (source.mode === 'api') {
        const resolved = this.resolveApiUrl(source);
        if (!resolved) {
          result.error =
            'data.gov.in not configured (set DATA_GOV_API_KEY & DATA_GOV_NCS_RESOURCE_ID)';
          this.logger.warn(`[${source.key}] ${result.error}`);
          return result;
        }
        effectiveUrl = resolved;
      }

      // A published RSS feed / open-data API is opt-in syndication, so robots.txt
      // (a crawler directive) only gates HTML page scraping.
      if (source.mode === 'html' && !(await this.allowedByRobots(source.url))) {
        result.error = 'blocked by robots.txt';
        this.logger.warn(`[${source.key}] blocked by robots.txt`);
        return result;
      }

      const items =
        source.mode === 'rss'
          ? await this.parseRss(source)
          : source.mode === 'api'
            ? await this.parseApi(source, effectiveUrl)
            : await this.parseHtml(source);

      const plural = PLURAL[source.contentType];
      for (const item of this.filterByTitle(source, items).slice(
        0,
        this.maxItems,
      )) {
        if (!item.title || !item.link) {
          result.skipped++;
          continue;
        }
        if (await this.writer.existsBySourceUrl(plural, item.link)) {
          result.skipped++;
          continue;
        }
        // Only enrich items we're actually about to write, to avoid wasted
        // detail fetches on duplicates.
        if (source.enrich) {
          item.details = await this.enrich(source, item.link);
          await this.sleep(300);
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
    } finally {
      await this.recorder.finish(jobId, {
        status: result.error ? 'error' : 'success',
        itemsFound: result.created + result.skipped,
        itemsInserted: result.created,
        itemsSkipped: result.skipped,
        durationMs: Date.now() - startedAt,
        error: result.error ?? null,
      });
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

  /**
   * Fill the {API_KEY}/{RESOURCE_ID} placeholders from env. Returns null when
   * either is missing so the source is skipped rather than fetched blindly.
   */
  private resolveApiUrl(source: ScrapeSource): string | null {
    const key = this.config.get<string>('DATA_GOV_API_KEY') || '';
    const resource = this.config.get<string>('DATA_GOV_NCS_RESOURCE_ID') || '';
    if (!key || !resource) return null;
    return source.url
      .replace('{RESOURCE_ID}', encodeURIComponent(resource))
      .replace('{API_KEY}', encodeURIComponent(key));
  }

  /** data.gov.in JSON: `{ records: [...] }`, mapped via `mapDataGovRecord`. */
  private async parseApi(
    source: ScrapeSource,
    url: string,
  ): Promise<ScrapedItem[]> {
    const json = await this.fetchJson(url);
    const path = source.recordsPath || 'records';
    const records = (json?.[path] ?? []) as Record<string, unknown>[];
    if (!Array.isArray(records)) return [];
    const out: ScrapedItem[] = [];
    for (const rec of records) {
      const item = mapDataGovRecord(rec, source.apiFields);
      if (item) out.push(item);
    }
    return out;
  }

  private async fetchJson(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
    });
    // Never leak the api-key query string into logs.
    if (!res.ok) throw new Error(`fetch ${url.split('?')[0]} -> ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  /** Keep/drop items by the source's title include/exclude regexes. */
  private filterByTitle(
    source: ScrapeSource,
    items: ScrapedItem[],
  ): ScrapedItem[] {
    const inc = source.titleInclude
      ? new RegExp(source.titleInclude, 'i')
      : null;
    const exc = source.titleExclude
      ? new RegExp(source.titleExclude, 'i')
      : null;
    if (!inc && !exc) return items;
    return items.filter(
      (it) => (!inc || inc.test(it.title)) && (!exc || !exc.test(it.title)),
    );
  }

  /** Fetch an item's detail page and parse structured posting fields. */
  private async enrich(
    source: ScrapeSource,
    url: string,
  ): Promise<JobPostingDetails | undefined> {
    try {
      const html = await this.fetchText(url);
      if (source.detailParser === 'freejobalert') {
        return parseFreejobalert(html, url);
      }
      return undefined;
    } catch (err) {
      this.logger.warn(
        `[${source.key}] enrich failed for ${url}: ${(err as Error).message}`,
      );
      return undefined;
    }
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
      case 'job-result': {
        const d = item.details;
        return {
          title: item.title,
          slug,
          official_link: d?.resultLink || d?.officialWebsite || item.link,
          result_date: d?.resultDate || date,
          description: item.summary,
          organization: d?.organization,
          post_name: d?.postName,
          active: true,
          source_meta,
        };
      }
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
      case 'job-news': {
        const d = item.details;
        const posting = d
          ? {
              is_posting: true,
              organization: d.organization,
              vacancies: d.vacancies,
              qualification: d.qualification,
              eligibility: d.eligibility,
              age_limit: d.ageLimit,
              salary: d.salary,
              application_fee: d.applicationFee,
              last_date: d.lastDate,
              apply_link: d.applyLink,
              notification_link: d.notificationLink,
              official_website: d.officialWebsite,
            }
          : {};
        return {
          title: item.title,
          slug,
          source_link: item.link,
          summary: item.summary,
          published_date: date,
          category: source.newsCategory ?? 'job',
          active: true,
          source_meta,
          ...posting,
        };
      }
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
