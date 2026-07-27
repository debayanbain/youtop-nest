/* Seed real notices for the live API test (Phase 7). Ingests UPSC + inserts one
 * already-expired row (to prove status filtering). No cleanup — see the curl
 * step / DELETE afterwards.
 */
import 'reflect-metadata';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
import { createHash } from 'crypto';
import { PostgresService } from '../src/core/database/postgres.service';
import { NoticeIngestService } from '../src/scraping/ingest/notice-ingest.service';
import { NoticeClassifierService } from '../src/scraping/ingest/notice-classifier.service';
import { AiEnrichmentService } from '../src/scraping/enrich/ai-enrichment.service';
import { ScraperHttpService } from '../src/scraping/sources/scraper-http.service';
import { UpscScraper } from '../src/scraping/scrapers/upsc.scraper';

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
  const enricher = new AiEnrichmentService(cfg);
  const ingest = new NoticeIngestService(
    db,
    new NoticeClassifierService(cfg, enricher),
    enricher,
  );
  const raws = await new UpscScraper(new ScraperHttpService(cfg)).scrape({} as any);
  let ins = 0;
  for (const r of raws) if ((await ingest.upsert('upsc', 'UPSC', r)).inserted) ins++;

  // one expired notice
  await db.execute(
    `INSERT INTO notices (source_id, notice_type, title, org_name, source_url, published_date, dedupe_hash, status)
     VALUES ('upsc','job','EXPIRED seed notice','UPSC','https://upsc.gov.in/expired-seed','2020-01-01',:h,'expired')
     ON CONFLICT (dedupe_hash) DO NOTHING`,
    { h: createHash('sha256').update('upsc|expired-seed').digest('hex') },
  );

  const c = await db.select<{ n: number }>(
    "SELECT count(*)::int n FROM notices WHERE source_id='upsc'",
  );
  console.log(`seeded: ingested=${ins}, total upsc rows=${c[0].n}`);
  await db.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
