/**
 * The single normalized shape every source scraper returns. Scrapers know
 * nothing about Strapi — the NormalizerService maps this onto the right content
 * type. `category` drives that routing: `job` -> job-news posting,
 * `scholarship` -> scholarship, everything else -> job-result (with `kind`).
 */
export type NoticeCategory =
  | 'job'
  | 'result'
  | 'final-result'
  | 'admit-card'
  | 'answer-key'
  | 'merit-list'
  | 'counseling'
  | 'cutoff'
  | 'notification'
  | 'scholarship';

/** Categories that map to job-result; the value doubles as job-result `kind`. */
export const RESULT_CATEGORIES: NoticeCategory[] = [
  'result',
  'final-result',
  'admit-card',
  'answer-key',
  'merit-list',
  'counseling',
  'cutoff',
  'notification',
];

export interface ScrapedResult {
  title: string;
  organisation: string;
  category: NoticeCategory;
  /** Official/source/apply/notice URL — also the dedup key. */
  url: string;
  publishedAt?: string; // ISO yyyy-mm-dd
  description?: string;
  image?: string;
  tags?: string[];
  // Optional structured extras (filled when the source exposes them).
  postName?: string;
  vacancies?: string;
  qualification?: string;
  eligibility?: string;
  lastDate?: string;
  resultDate?: string;
  fee?: string;
  notificationPdf?: string;
  applyLink?: string;
}
