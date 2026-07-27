/* Throwaway standalone runner: runs every registered NoticeScraper against its
 * SourceConfig (mirrors the processor) and prints parsed notices + a per-type
 * tally, so RSS coverage can be eyeballed. Run:
 *   npx ts-node -T --compiler-options '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' scripts/test-scrapers.ts
 */
import 'reflect-metadata';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
import { ScraperHttpService } from '../src/scraping/sources/scraper-http.service';
import { UpscScraper } from '../src/scraping/scrapers/upsc.scraper';
import { SscScraper } from '../src/scraping/scrapers/ssc.scraper';
import { RrbScraper } from '../src/scraping/scrapers/rrb.scraper';
import { DataGovNcsScraper } from '../src/scraping/scrapers/data-gov-ncs.scraper';
import { RssNoticeScraper } from '../src/scraping/scrapers/rss-notice.scraper';
import { NoticeScraperFactory } from '../src/scraping/scrapers/notice-scraper.factory';
import { NOTICE_SOURCES } from '../src/scraping/sources/notice-source.registry';

const cfg: any = { get: (k: string) => process.env[k] };
const http = new ScraperHttpService(cfg);
const factory = new NoticeScraperFactory(
  new UpscScraper(http),
  new SscScraper(http),
  new RrbScraper(http),
  new DataGovNcsScraper(http, cfg),
  new RssNoticeScraper(http),
);

(async () => {
  let grand = 0;
  for (const source of NOTICE_SOURCES) {
    const scraper = factory.get(source.scraperClass);
    process.stdout.write(`\n===== ${source.id} (${source.tier}) =====\n`);
    if (!scraper) {
      console.log('  no scraper');
      continue;
    }
    try {
      const items = await scraper.scrape(source);
      grand += items.length;
      const tally: Record<string, number> = {};
      items.forEach((i) => {
        const t = i.noticeType ?? 'null';
        tally[t] = (tally[t] ?? 0) + 1;
      });
      console.log(
        `  count=${items.length}  types=${Object.entries(tally)
          .map(([k, v]) => `${k}:${v}`)
          .join(' ')}`,
      );
      items.slice(0, 3).forEach((i) =>
        console.log(`   • [${i.noticeType ?? 'null'}] ${i.title.slice(0, 70)}`),
      );
    } catch (e) {
      console.log('  ERROR:', (e as Error).message);
    }
  }
  console.log(`\nGRAND TOTAL scraped this pass: ${grand}`);
})();
