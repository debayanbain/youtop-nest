import { SourceScraper } from '../interfaces/source-scraper.interface';

/**
 * Legacy modular official-site scrapers that wrote into Strapi. These have been
 * migrated to the Postgres `notices` pipeline (see `notice-source.registry.ts`
 * + `src/scraping/scrapers/`), so this list is now empty and the legacy
 * ScraperService only runs the RSS/HTML/api `SCRAPE_SOURCES` (Strapi) sources.
 *
 * Kept as a typed empty array (rather than deleted) so the legacy
 * ScraperService.runSourceScraper path and its wiring keep compiling untouched.
 */
export const SOURCE_SCRAPERS: SourceScraper[] = [];
