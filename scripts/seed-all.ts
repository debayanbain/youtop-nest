/* One-off: run every notices source through the real ingest (what the scheduler
 * does once) to populate the board with live data. AI off (heuristic classify).
 * Run:
 *   npx ts-node -T --compiler-options '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' scripts/seed-all.ts
 */
import 'reflect-metadata';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
import { PostgresService } from '../src/core/database/postgres.service';
import { NoticeIngestService } from '../src/scraping/ingest/notice-ingest.service';
import { NoticeClassifierService } from '../src/scraping/ingest/notice-classifier.service';
import { AiEnrichmentService } from '../src/scraping/enrich/ai-enrichment.service';
import { ScraperHttpService } from '../src/scraping/sources/scraper-http.service';
import { UpscScraper } from '../src/scraping/scrapers/upsc.scraper';
import { SscScraper } from '../src/scraping/scrapers/ssc.scraper';
import { RrbScraper } from '../src/scraping/scrapers/rrb.scraper';
import { DataGovNcsScraper } from '../src/scraping/scrapers/data-gov-ncs.scraper';
import { RssNoticeScraper } from '../src/scraping/scrapers/rss-notice.scraper';
import { NoticeScraperFactory } from '../src/scraping/scrapers/notice-scraper.factory';
import { NOTICE_SOURCES } from '../src/scraping/sources/notice-source.registry';

const cfg: any = {
  get: (k: string) => process.env[k],
  getOrThrow: (k: string) => {
    const v = process.env[k];
    if (v == null) throw new Error(`missing ${k}`);
    return v;
  },
};

(async () => {
  const db = new PostgresService(cfg);
  const http = new ScraperHttpService(cfg);
  const enricher = new AiEnrichmentService(cfg);
  const ingest = new NoticeIngestService(
    db,
    new NoticeClassifierService(cfg, enricher),
    enricher,
  );
  const factory = new NoticeScraperFactory(
    new UpscScraper(http),
    new SscScraper(http),
    new RrbScraper(http),
    new DataGovNcsScraper(http, cfg),
    new RssNoticeScraper(http),
  );

  let inserted = 0;
  for (const source of NOTICE_SOURCES) {
    const scraper = factory.get(source.scraperClass);
    if (!scraper) continue;
    try {
      const raws = await scraper.scrape(source);
      let n = 0;
      for (const raw of raws) {
        if ((await ingest.upsert(source.id, source.orgName, raw)).inserted) n++;
      }
      inserted += n;
      console.log(`  ${source.id.padEnd(20)} +${n} (of ${raws.length})`);
    } catch (e) {
      console.log(`  ${source.id.padEnd(20)} ERROR ${(e as Error).message}`);
    }
  }

  const byType = await db.select<{ notice_type: string; c: number }>(
    "SELECT notice_type, count(*)::int c FROM notices WHERE status='active' GROUP BY notice_type ORDER BY c DESC",
  );
  const total = await db.select<{ n: number }>(
    'SELECT count(*)::int n FROM notices',
  );
  console.log(`\ninserted this run: ${inserted}`);
  console.log('active by type:', byType.map((r) => `${r.notice_type}:${r.c}`).join('  '));
  console.log('total rows:', total[0].n);
  await db.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
