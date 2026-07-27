import type { NoticeType } from '../notice-type';

/**
 * Official-source registry for the Postgres `notices` pipeline (Option A: the
 * legacy RSS -> Strapi sources in `sources.registry.ts` are untouched; these
 * official government sources write to the `notices` table instead).
 *
 * One entry per source. `scraperClass` maps to a NoticeScraper resolved by
 * NoticeScraperFactory; `id` becomes the row's `source_id` and the BullMQ
 * repeatable `jobId` (`scrape-<id>`). `noticeTypes` documents what a source can
 * emit (used for nav/counts), not a hard filter — the classifier decides the
 * per-notice type.
 */
export interface SourceConfig {
  id: string;
  orgName: string;
  tier: 'api' | 'rss' | 'html';
  noticeTypes: NoticeType[];
  scraperClass: string;
  url: string;
  /** data.gov.in per-field record-key overrides (unchanged existing pattern). */
  apiFields?: Record<string, string>;
  /* --- RSS tier only --- */
  /** Keep only items whose title matches (case-insensitive regex source). */
  titleInclude?: string;
  /** Drop items whose title matches (case-insensitive regex source). */
  titleExclude?: string;
  /** Fallback type when the keyword heuristic returns null (e.g. 'job' feed). */
  defaultType?: NoticeType;
}

export const NOTICE_SOURCES: SourceConfig[] = [
  // Official open-data API (data.gov.in NCS). Kept as-is (tier 'api'); the
  // scraper is a no-op until DATA_GOV_API_KEY + DATA_GOV_NCS_RESOURCE_ID are set,
  // so it's safe to schedule alongside the HTML sources.
  {
    id: 'data-gov-ncs',
    orgName: 'National Career Service',
    tier: 'api',
    noticeTypes: ['job'],
    scraperClass: 'DataGovNcsScraper',
    url: 'https://api.data.gov.in/resource/{RESOURCE_ID}?api-key={API_KEY}&format=json&limit=50',
    apiFields: {},
  },
  {
    id: 'upsc',
    orgName: 'UPSC',
    tier: 'html',
    noticeTypes: ['job', 'result', 'admit_card', 'notification'],
    scraperClass: 'UpscScraper',
    url: 'https://upsc.gov.in',
  },
  {
    id: 'ssc',
    orgName: 'SSC',
    tier: 'html',
    noticeTypes: ['job', 'result', 'admit_card', 'answer_key'],
    scraperClass: 'SscScraper',
    url: 'https://ssc.gov.in',
  },
  {
    id: 'rrb',
    orgName: 'Railway Recruitment Board (Mumbai)',
    tier: 'html',
    noticeTypes: ['job', 'result', 'admit_card'],
    scraperClass: 'RrbScraper',
    // National rrbcdg.gov.in has a broken TLS cert; Mumbai is the working board.
    url: 'https://rrbmumbai.gov.in/',
  },

  // ---------------------------------------------------------------------------
  // Broad-coverage RSS aggregators — this is what pushes the board toward "every
  // Indian job post". FreeJobAlert + Google News already aggregate nearly all
  // sarkari vacancies/results across the country; one RssNoticeScraper drives
  // every feed by `url`. Each is capped at SCRAPER_MAX_ITEMS per run and
  // classified by the same heuristic. Add a feed = add a row here.
  // ---------------------------------------------------------------------------
  {
    id: 'freejobalert',
    orgName: 'FreeJobAlert',
    tier: 'rss',
    noticeTypes: ['job', 'result', 'admit_card', 'answer_key'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://www.freejobalert.com/feed/',
    titleInclude:
      'recruitment|vacanc|online form|apply online|notification|\\bposts?\\b|bharti|result|admit card|answer key',
    defaultType: 'job',
  },
  {
    id: 'gnews-sarkari',
    orgName: 'Sarkari Naukri (news)',
    tier: 'rss',
    noticeTypes: ['job'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://news.google.com/rss/search?q=sarkari+naukri+recruitment+notification+2026&hl=en-IN&gl=IN&ceid=IN:en',
    defaultType: 'job',
  },
  {
    id: 'gnews-ssc-ibps-rrb',
    orgName: 'SSC / IBPS / Railway (news)',
    tier: 'rss',
    noticeTypes: ['job'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://news.google.com/rss/search?q=SSC+OR+IBPS+OR+RRB+OR+railway+recruitment+2026&hl=en-IN&gl=IN&ceid=IN:en',
    defaultType: 'job',
  },
  {
    id: 'gnews-state-psc',
    orgName: 'State PSC (news)',
    tier: 'rss',
    noticeTypes: ['job'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://news.google.com/rss/search?q=UPPSC+OR+BPSC+OR+MPSC+OR+WBPSC+OR+RPSC+OR+MPPSC+recruitment&hl=en-IN&gl=IN&ceid=IN:en',
    defaultType: 'job',
  },
  {
    id: 'gnews-defence-police',
    orgName: 'Defence / Police (news)',
    tier: 'rss',
    noticeTypes: ['job'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://news.google.com/rss/search?q=army+OR+police+OR+defence+OR+CRPF+OR+BSF+recruitment+india&hl=en-IN&gl=IN&ceid=IN:en',
    defaultType: 'job',
  },
  {
    id: 'gnews-psu-teaching',
    orgName: 'PSU / Teaching (news)',
    tier: 'rss',
    noticeTypes: ['job'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://news.google.com/rss/search?q=teaching+OR+professor+OR+PSU+OR+ONGC+OR+NTPC+recruitment+india&hl=en-IN&gl=IN&ceid=IN:en',
    defaultType: 'job',
  },
  {
    id: 'gnews-results-admit',
    orgName: 'Results & Admit Cards (news)',
    tier: 'rss',
    noticeTypes: ['result', 'admit_card', 'answer_key', 'merit_list', 'cutoff'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://news.google.com/rss/search?q=exam+result+OR+admit+card+OR+answer+key+OR+merit+list+india+2026&hl=en-IN&gl=IN&ceid=IN:en',
  },
  {
    id: 'gnews-scholarship',
    orgName: 'Scholarships (news)',
    tier: 'rss',
    noticeTypes: ['scholarship'],
    scraperClass: 'RssNoticeScraper',
    url: 'https://news.google.com/rss/search?q=scholarship+students+india+apply+2026&hl=en-IN&gl=IN&ceid=IN:en',
    defaultType: 'scholarship',
  },
];
