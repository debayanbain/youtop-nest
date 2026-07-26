import type { ApiFieldAliases } from './data-gov.mapper';

export type ScrapeContentType = 'job-result' | 'scholarship' | 'job-news';

/** CSS selectors relative to `itemSelector` (HTML mode only). */
export interface ScrapeFieldSelectors {
  title?: string;
  link?: string;
  date?: string;
  summary?: string;
  image?: string;
}

/** Internal, fully-resolved source the scraper runs against. */
export interface ScrapeSource {
  key: string;
  contentType: ScrapeContentType;
  mode: 'rss' | 'html' | 'api';
  url: string;
  enabled: boolean;
  sourceName?: string;
  /** For job-news: value for the `category` enum (exam/job/result/notice). */
  newsCategory?: string;
  itemSelector?: string;
  fields?: ScrapeFieldSelectors;
  /* --- API mode (data.gov.in) only --- */
  /** JSON array path in the response holding the records. Default 'records'. */
  recordsPath?: string;
  /** Per-field record key overrides for the data.gov.in mapper. */
  apiFields?: ApiFieldAliases;
  /* --- Detail enrichment (job postings) --- */
  /** Fetch each item's page and parse structured posting fields. */
  enrich?: boolean;
  /** Which detail parser to run when `enrich` is set. */
  detailParser?: 'freejobalert';
  /** Only keep items whose title matches (case-insensitive regex source). */
  titleInclude?: string;
  /** Drop items whose title matches (case-insensitive regex source). */
  titleExclude?: string;
}

/* -------------------------------------------------------------------------- */
/*  EDIT HERE — same shape as `education RSS.js`.                              */
/*                                                                            */
/*  Google News RSS is the workhorse: free, no key, updates within minutes.   */
/*  Change the words after `q=` (spaces -> `+`, `OR` for any-of, `site:x` for */
/*  one site). Swap `hl=en-IN...` for `hl=bn...` for Bengali.                  */
/*  `category` maps to a content type: news/job -> Job News, result -> Job     */
/*  Results, scholarship -> Scholarships. Everything lands as a review DRAFT.  */
/* -------------------------------------------------------------------------- */

type RawCategory = 'news' | 'job' | 'result' | 'scholarship';

interface RawSource {
  name: string;
  type: 'rss' | 'html' | 'api';
  category: RawCategory;
  url: string;
  enabled: boolean;
  itemSelector?: string;
  fields?: ScrapeFieldSelectors;
  recordsPath?: string;
  apiFields?: ApiFieldAliases;
  enrich?: boolean;
  detailParser?: 'freejobalert';
  titleInclude?: string;
  titleExclude?: string;
}

const RAW_SOURCES: RawSource[] = [
  // ----------------------- OFFICIAL API (data.gov.in) ----------------------
  // Generic data.gov.in open-data source (mode 'api'). DORMANT by default:
  // the NCS datasets on data.gov.in turned out to be stale MONTHLY AGGREGATE
  // stats (e.g. "Vacancies Mobilised till 30 Sep 2023"), not live job listings,
  // so there is nothing worth ingesting yet. The pipeline is kept ready — the
  // day a real per-listing open-data API exists, set enabled: true, point `url`
  // at it (keep the {RESOURCE_ID}/{API_KEY} placeholders), set env
  // DATA_GOV_API_KEY + DATA_GOV_NCS_RESOURCE_ID, and override record field names
  // in `apiFields` (e.g. { title: 'jobtitle', date: 'postedon' }) if needed.
  {
    name: 'data.gov.in — NCS Jobs',
    type: 'api',
    category: 'job',
    url: 'https://api.data.gov.in/resource/{RESOURCE_ID}?api-key={API_KEY}&format=json&limit=50',
    enabled: false,
    recordsPath: 'records',
    apiFields: {},
  },

  // ------------------------------- NEWS ------------------------------------
  {
    name: 'Google News — Education',
    type: 'rss',
    category: 'news',
    url: 'https://news.google.com/rss/search?q=education+news+india&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: false,
  },
  {
    name: 'Google News — CBSE / NEET / JEE',
    type: 'rss',
    category: 'news',
    url: 'https://news.google.com/rss/search?q=CBSE+OR+NEET+OR+JEE+news&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: false,
  },
  {
    name: 'The Hindu — Education',
    type: 'rss',
    category: 'news',
    url: 'https://www.thehindu.com/education/feeder/default.rss',
    enabled: false,
  },
  {
    name: 'Indian Express — Education',
    type: 'rss',
    category: 'news',
    url: 'https://indianexpress.com/section/education/feed/',
    enabled: false,
  },

  // --------------------------- JOB POSTINGS --------------------------------
  // Actual vacancy notifications (not news). RSS gives the list; `enrich` then
  // fetches each posting page and the freejobalert parser pulls organization,
  // vacancies, qualification, fee, dates and the official apply/notification
  // links. titleInclude keeps recruitment/online-form items; titleExclude drops
  // results/admit-cards/answer-keys that share the feed. These land as job-news
  // with is_posting = true.
  {
    name: 'FreeJobAlert — Latest Jobs',
    type: 'rss',
    category: 'job',
    url: 'https://www.freejobalert.com/feed/',
    enabled: true,
    enrich: true,
    detailParser: 'freejobalert',
    titleInclude: 'recruitment|vacanc|online form|apply online|notification|\\bposts?\\b|bharti|bharati|naukri',
    titleExclude: 'result|answer key|admit card|cut ?off|merit list|syllabus|date sheet|time table|counsell?ing|admission|entrance|scorecard|score card',
  },

  // ------------------------------- JOBS ------------------------------------
  {
    name: 'Google News — Government Jobs',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=sarkari+naukri+recruitment+notification&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },
  {
    name: 'Google News — Bank / SSC / Railway Jobs',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=SSC+OR+IBPS+OR+railway+recruitment+2026&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },
  {
    name: 'Google News — West Bengal Jobs',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=WBPSC+OR+WBSSC+recruitment&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },
  {
    name: 'Google News — Jagran Josh',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=site:jagranjosh.com&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },

  // ------------------------------ RESULTS ----------------------------------
  {
    name: 'Google News — Exam Results & Admit Cards',
    type: 'rss',
    category: 'result',
    url: 'https://news.google.com/rss/search?q=board+exam+result+OR+admit+card+india&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },
  {
    name: 'Google News — West Bengal Board Results',
    type: 'rss',
    category: 'result',
    url: 'https://news.google.com/rss/search?q=WBBSE+OR+WBCHSE+OR+Madhyamik+OR+%22higher+secondary%22+result&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },

  // ---------------------------- SCHOLARSHIPS -------------------------------
  {
    name: 'Google News — Scholarships',
    type: 'rss',
    category: 'scholarship',
    url: 'https://news.google.com/rss/search?q=scholarship+students+india+apply&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },
  {
    name: 'Google News — National Scholarship Portal',
    type: 'rss',
    category: 'scholarship',
    url: 'https://news.google.com/rss/search?q=national+scholarship+portal+OR+NSP+scholarship&hl=en-IN&gl=IN&ceid=IN:en',
    enabled: true,
  },

  // --------------------------- BENGALI (বাংলা) -----------------------------
  {
    name: 'Bengali — Job News',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF%E0%A6%B0%20%E0%A6%96%E0%A6%AC%E0%A6%B0%20%E0%A6%AA%E0%A6%B6%E0%A7%8D%E0%A6%9A%E0%A6%BF%E0%A6%AE%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%97&hl=bn&gl=IN&ceid=IN:bn',
    enabled: true,
  },
  {
    name: 'Bengali — WB Government Jobs',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=%E0%A6%AA%E0%A6%B6%E0%A7%8D%E0%A6%9A%E0%A6%BF%E0%A6%AE%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%97%20%E0%A6%B8%E0%A6%B0%E0%A6%95%E0%A6%BE%E0%A6%B0%E0%A6%BF%20%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF%20%E0%A6%A8%E0%A6%BF%E0%A6%AF%E0%A6%BC%E0%A7%8B%E0%A6%97&hl=bn&gl=IN&ceid=IN:bn',
    enabled: true,
  },
  {
    name: 'Bengali — Anandabazar Jobs',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=site%3Aanandabazar.com%20%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF&hl=bn&gl=IN&ceid=IN:bn',
    enabled: true,
  },
  {
    name: 'Bengali — Ei Samay Jobs',
    type: 'rss',
    category: 'job',
    url: 'https://news.google.com/rss/search?q=site%3Aeisamay.com%20%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF&hl=bn&gl=IN&ceid=IN:bn',
    enabled: true,
  },
  {
    name: 'Bengali — Results (Madhyamik / HS)',
    type: 'rss',
    category: 'result',
    url: 'https://news.google.com/rss/search?q=%E0%A6%AE%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%AE%E0%A6%BF%E0%A6%95%20%E0%A6%89%E0%A6%9A%E0%A7%8D%E0%A6%9A%E0%A6%AE%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%AE%E0%A6%BF%E0%A6%95%20%E0%A6%B0%E0%A7%87%E0%A6%9C%E0%A6%BE%E0%A6%B2%E0%A7%8D%E0%A6%9F&hl=bn&gl=IN&ceid=IN:bn',
    enabled: true,
  },
  {
    name: 'Bengali — Scholarships',
    type: 'rss',
    category: 'scholarship',
    url: 'https://news.google.com/rss/search?q=%E0%A6%B8%E0%A7%8D%E0%A6%95%E0%A6%B2%E0%A6%BE%E0%A6%B0%E0%A6%B6%E0%A6%BF%E0%A6%AA%20%E0%A6%AA%E0%A6%B6%E0%A7%8D%E0%A6%9A%E0%A6%BF%E0%A6%AE%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%97%20%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%A5%E0%A7%80&hl=bn&gl=IN&ceid=IN:bn',
    enabled: true,
  },
  {
    name: 'Bengali OneIndia — News',
    type: 'rss',
    category: 'news',
    url: 'https://bengali.oneindia.com/rss/',
    enabled: true,
  },
];

const CATEGORY_MAP: Record<
  RawCategory,
  { contentType: ScrapeContentType; newsCategory?: string }
> = {
  news: { contentType: 'job-news', newsCategory: 'notice' },
  job: { contentType: 'job-news', newsCategory: 'job' },
  result: { contentType: 'job-result' },
  scholarship: { contentType: 'scholarship' },
};

function slugifyKey(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'source'
  );
}

/** Resolved sources the scraper consumes (raw list adapted to internal shape). */
export const SCRAPE_SOURCES: ScrapeSource[] = RAW_SOURCES.filter(
  (s) => !!s.url,
).map((s) => {
  const mapped = CATEGORY_MAP[s.category];
  return {
    key: slugifyKey(s.name),
    contentType: mapped.contentType,
    newsCategory: mapped.newsCategory,
    mode: s.type,
    url: s.url,
    sourceName: s.name,
    itemSelector: s.itemSelector,
    fields: s.fields,
    recordsPath: s.recordsPath,
    apiFields: s.apiFields,
    enrich: s.enrich,
    detailParser: s.detailParser,
    titleInclude: s.titleInclude,
    titleExclude: s.titleExclude,
    enabled: s.enabled,
  };
});
