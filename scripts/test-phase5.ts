/* Throwaway Phase 5 verification:
 *  A) AI OFF (real wiring): heuristic-only classification still ingests; seo cols stay NULL.
 *  B) Enrichment ON (stubbed enricher, since no ANTHROPIC_API_KEY here): seo_description /
 *     seo_keywords populate on insert while title/published_date are untouched.
 * Run:
 *   npx ts-node -T --compiler-options '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' scripts/test-phase5.ts
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
import type { RawNotice } from '../src/scraping/interfaces/notice-scraper.interface';

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

  // ---------- A) AI OFF, real wiring ----------
  const realEnricher = new AiEnrichmentService(cfg); // no key -> isEnabled false
  const realClassifier = new NoticeClassifierService(cfg, realEnricher);
  const ingestOff = new NoticeIngestService(db, realClassifier, realEnricher);
  console.log('enricher.isEnabled (AI off expected false):', realEnricher.isEnabled);

  const raws = await new UpscScraper(new ScraperHttpService(cfg)).scrape({} as any);
  let ins = 0;
  for (const r of raws) if ((await ingestOff.upsert('upsc', 'UPSC', r)).inserted) ins++;
  const off = await db.select<{ notice_type: string; c: number }>(
    'SELECT notice_type, count(*)::int c FROM notices WHERE source_id=:s GROUP BY notice_type ORDER BY c DESC',
    { s: 'upsc' },
  );
  console.log(`A) inserted=${ins}; type distribution:`, off.map((x) => `${x.notice_type}:${x.c}`).join(' '));
  const seoNull = await db.select<{ n: number }>(
    'SELECT count(*)::int n FROM notices WHERE source_id=:s AND (seo_description IS NOT NULL OR seo_keywords IS NOT NULL)',
    { s: 'upsc' },
  );
  console.log('A) rows with SEO set (expect 0):', seoNull[0].n);

  // ---------- B) Enrichment ON (stubbed) ----------
  const fakeEnricher: any = {
    isEnabled: true,
    enrich: async () => ({
      seoDescription: 'UPSC notification — apply and check details on the official portal.',
      seoKeywords: 'upsc, notification, government, apply, 2026',
    }),
    classifyNoticeType: async () => 'notification',
  };
  const fakeClassifier: any = {
    classify: async (_t: string, h: string | null) => h ?? 'notification',
  };
  const ingestOn = new NoticeIngestService(db, fakeClassifier, fakeEnricher);
  const sample: RawNotice = {
    title: 'PHASE5 SEO Test Notice — Assistant Engineer 2026',
    sourceUrl: 'https://example.gov.in/phase5-seo-test',
    publishedDate: '2026-07-27',
    noticeType: 'notification',
    rawFields: { test: true },
  };
  const res = await ingestOn.upsert('phase5test', 'PhaseFive Dept', sample);
  const row = (
    await db.select<any>(
      'SELECT title, published_date, notice_type, seo_description, seo_keywords FROM notices WHERE source_id=:s',
      { s: 'phase5test' },
    )
  )[0];
  console.log('\nB) inserted:', res.inserted);
  console.log('B) title unchanged:', row.title === sample.title);
  console.log('B) published_date unchanged:', String(row.published_date), '(expect 2026-07-27)');
  console.log('B) seo_description:', row.seo_description);
  console.log('B) seo_keywords:', JSON.stringify(row.seo_keywords));

  // cleanup
  await db.execute('DELETE FROM notices WHERE source_id IN (:a,:b)', {
    a: 'upsc',
    b: 'phase5test',
  } as any);
  console.log('\ncleanup done');
  await db.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
