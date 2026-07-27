/**
 * The single notice-type enum shared by the DB `notice_type` type, the Notice
 * model, every scraper's classify() output, the classifier fallback, and the
 * API DTOs. One enum, nine values — never nine tables. Keep this list in exact
 * sync with the `notice_type` Postgres enum (see the create-notices migration).
 */
export const NOTICE_TYPES = [
  'job',
  'result',
  'admit_card',
  'answer_key',
  'notification',
  'scholarship',
  'admission',
  'cutoff',
  'merit_list',
] as const;

export type NoticeType = (typeof NOTICE_TYPES)[number];

/** Runtime guard used by scrapers/classifier before trusting a raw value. */
export function isNoticeType(v: unknown): v is NoticeType {
  return (
    typeof v === 'string' && (NOTICE_TYPES as readonly string[]).includes(v)
  );
}
