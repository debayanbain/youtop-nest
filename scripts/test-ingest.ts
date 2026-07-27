/* Throwaway Phase 4 verification: proves the ingest path (dedupe_hash +
 * ON CONFLICT idempotency) against the real DB, and that the scheduler
 * registers one repeatable job per source. Run:
 *   npx ts-node -T --compiler-options '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' scripts/test-ingest.ts
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
import { NoticeScraperProducer } from '../src/scraping/notice-scraper.producer';
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
  const enricher = new AiEnrichmentService(cfg);
  const ingest = new NoticeIngestService(
    db,
    new NoticeClassifierService(cfg, enricher),
    enricher,
  );
  const http = new ScraperHttpService(cfg);
  const upsc = new UpscScraper(http);

  const raws = await upsc.scrape({} as any);
  console.log('scraped:', raws.length);

  const runOnce = async () => {
    let ins = 0,
      skip = 0;
    for (const r of raws) {
      const { inserted } = await ingest.upsert('upsc', 'UPSC', r);
      inserted ? ins++ : skip++;
    }
    return { ins, skip };
  };

  const r1 = await runOnce();
  console.log('run1:', r1, '(expect ins>0)');
  const r2 = await runOnce();
  console.log('run2:', r2, '(expect ins=0 — dedupe holds)');

  const rows = await db.select<{ n: number; d: number }>(
    'SELECT count(*)::int n, count(distinct dedupe_hash)::int d FROM notices WHERE source_id = :s',
    { s: 'upsc' },
  );
  console.log('db rows:', rows[0], '(n should equal d — no dup hashes)');

  const sample = await db.select<{ notice_type: string; title: string }>(
    'SELECT notice_type, title FROM notices WHERE source_id = :s ORDER BY created_at DESC LIMIT 3',
    { s: 'upsc' },
  );
  sample.forEach((x) => console.log('  •', x.notice_type, '::', x.title.slice(0, 60)));

  // Scheduler: one repeatable job per source.
  const added: any[] = [];
  const fakeQueue: any = {
    add: async (name: string, data: any, opts: any) => {
      added.push({ name, data, opts });
    },
  };
  process.env.SCRAPE_SCHEDULE_ENABLED = 'true';
  const producer = new NoticeScraperProducer(fakeQueue, cfg);
  await producer.onModuleInit();
  console.log(
    `\nscheduler registered ${added.length} jobs (sources=${NOTICE_SOURCES.length}):`,
    added.map((a) => a.opts.jobId).join(', '),
  );
  console.log(
    'every job repeatable + stable jobId:',
    added.every((a) => a.opts.repeat?.every && a.opts.jobId?.startsWith('scrape-')),
  );

  await db.execute('DELETE FROM notices WHERE source_id = :s', { s: 'upsc' });
  console.log('\ncleanup done (upsc rows removed)');
  await db.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
