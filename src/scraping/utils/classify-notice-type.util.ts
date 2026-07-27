import type { NoticeType } from '../notice-type';

/**
 * In-scraper heuristic classifier (spec Phase 3.4). Keyword-matches a notice
 * title to a NoticeType. Returns null when nothing matches confidently — the
 * scraper passes that null to NoticeClassifierService (Phase 5), which applies
 * the AI fallback (if enabled) and otherwise defaults to 'notification'. Keeping
 * the no-match case as null (rather than defaulting here) is what lets the AI
 * fallback ever run; the net default is still 'notification'.
 *
 * Order matters: the most specific patterns are tested before the generic
 * result/job/notification buckets (e.g. "answer key" before "result",
 * "admit card" before "job").
 */
export function classifyNoticeType(title: string): NoticeType | null {
  const t = (title || '').toLowerCase();
  if (!t.trim()) return null;

  if (/\banswer\s*keys?\b/.test(t)) return 'answer_key';
  if (/\badmit\s*card|hall\s*ticket|e-?\s*admit|call\s*letter\b/.test(t))
    return 'admit_card';
  if (/\bmerit\s*list\b/.test(t)) return 'merit_list';
  if (/\bcut[\s-]?off\b/.test(t)) return 'cutoff';
  if (/\bscholarship|fellowship\b/.test(t)) return 'scholarship';
  if (/\badmission|counsell?ing|entrance\s*(exam|test)\b/.test(t))
    return 'admission';
  if (
    /\bresults?\b|written\s*result|final\s*result|score\s*cards?|marks\b|selected|shortlist|selection\s*list/.test(
      t,
    )
  )
    return 'result';
  if (
    /\brecruit|vacanc|advertisement|\badvt\b|apply\s*online|online\s*form|\bposts?\b|\bcen\b|bharti|naukri|engagement|appointment/.test(
      t,
    )
  )
    return 'job';
  if (
    /\bnotice|press\s*note|corrigendum|notification|circular|addendum/.test(t)
  )
    return 'notification';

  return null;
}
