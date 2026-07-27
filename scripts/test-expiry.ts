/* Throwaway Phase 6 verification: seed notices at various ages/types, run the
 * expiry sweep, assert the type-based TTL rules. Run:
 *   npx ts-node -T --compiler-options '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' scripts/test-expiry.ts
 */
import 'reflect-metadata';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
import { createHash } from 'crypto';
import { PostgresService } from '../src/core/database/postgres.service';
import { NoticeExpiryService } from '../src/scraping/ingest/notice-expiry.service';

const cfg: any = {
  get: (k: string) => process.env[k],
  getOrThrow: (k: string) => {
    const v = process.env[k];
    if (v == null) throw new Error(`missing ${k}`);
    return v;
  },
};
const SRC = 'expiry-test';
const h = (s: string) => createHash('sha256').update(s).digest('hex');

// [key, notice_type, days_ago | null, expected_status_after_sweep]
const seeds: [string, string, number | null, string][] = [
  ['job-100', 'job', 100, 'expired'],
  ['job-10', 'job', 10, 'active'],
  ['notification-100', 'notification', 100, 'expired'],
  ['admission-100', 'admission', 100, 'expired'],
  ['admit-40', 'admit_card', 40, 'expired'],
  ['admit-10', 'admit_card', 10, 'active'],
  ['answerkey-40', 'answer_key', 40, 'expired'],
  ['result-100', 'result', 100, 'active'], // never expires
  ['cutoff-100', 'cutoff', 100, 'active'],
  ['merit-100', 'merit_list', 100, 'active'],
  ['scholarship-100', 'scholarship', 100, 'active'],
  ['job-nulldate', 'job', null, 'active'], // no date -> never
];

(async () => {
  const db = new PostgresService(cfg);
  await db.execute('DELETE FROM notices WHERE source_id = :s', { s: SRC });

  for (const [key, type, days] of seeds) {
    const pub =
      days == null
        ? null
        : new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    await db.execute(
      `INSERT INTO notices (source_id, notice_type, title, org_name, source_url, published_date, dedupe_hash, status)
       VALUES (:s, :t, :title, 'Test', :url, :pub, :hash, 'active')`,
      {
        s: SRC,
        t: type,
        title: `Expiry test ${key}`,
        url: `https://example.gov.in/${key}`,
        pub,
        hash: h(`${SRC}|${key}`),
      },
    );
  }

  const { expired } = await new NoticeExpiryService(db).run();
  console.log('sweep expired count:', expired);

  const rows = await db.select<{ url: string; status: string }>(
    'SELECT source_url AS url, status FROM notices WHERE source_id = :s',
    { s: SRC },
  );
  const statusByKey = new Map(
    rows.map((r) => [r.url.split('/').pop()!, r.status]),
  );

  let pass = 0;
  let fail = 0;
  for (const [key, , , expected] of seeds) {
    const got = statusByKey.get(key);
    const ok = got === expected;
    ok ? pass++ : fail++;
    console.log(`  ${ok ? 'OK ' : 'XX '} ${key.padEnd(18)} expected=${expected} got=${got}`);
  }
  console.log(`\nresult: ${pass} pass, ${fail} fail`);

  await db.execute('DELETE FROM notices WHERE source_id = :s', { s: SRC });
  console.log('cleanup done');
  await db.disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
