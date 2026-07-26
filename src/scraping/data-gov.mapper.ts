/**
 * Maps a single data.gov.in record onto the scraper's normalized item shape.
 *
 * data.gov.in resources (National Career Service and friends) return
 * `{ records: [ {...}, ... ] }`, but the per-record FIELD NAMES differ from one
 * resource to the next. Rather than hard-code one schema, we probe a list of
 * likely aliases for each logical field, and let a source override the alias
 * lists via `apiFields`. Extracted as a pure function so it is unit-testable
 * without the Nest DI container.
 */

export interface NormalizedApiItem {
  title: string;
  link: string;
  date?: string;
  summary?: string;
}

/** Per-field alias overrides a source can supply (each prepended to defaults). */
export interface ApiFieldAliases {
  title?: string;
  link?: string;
  date?: string;
  summary?: string;
  id?: string;
}

type Rec = Record<string, unknown>;

const DEFAULTS = {
  title: [
    'title',
    'job_title',
    'jobtitle',
    'post',
    'post_name',
    'postname',
    'designation',
    'name',
    'vacancy',
  ],
  date: [
    'date',
    'posted_on',
    'postedon',
    'posted_date',
    'published_date',
    'notification_date',
    'last_date',
    'lastdate',
    'enddate',
    'closing_date',
  ],
  id: ['jobid', 'job_id', 'ncsjobid', 'id', 'sno', 's_no', 'srno'],
  link: ['url', 'link', 'apply_link', 'applylink', 'website', 'source_url'],
  org: [
    'organization',
    'organisation',
    'organizationname',
    'company',
    'company_name',
    'companyname',
    'employer',
    'department',
  ],
  sector: [
    'sector',
    'sectorname',
    'industry',
    'functional_area',
    'functionalarea',
  ],
  place: ['state', 'statename', 'location', 'district', 'districtname', 'city'],
} as const;

/** First non-empty stringified value among the candidate keys. */
function pick(rec: Rec, keys: (string | undefined)[]): string {
  for (const k of keys) {
    if (!k) continue;
    const v = rec[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

/**
 * Returns a normalized item, or null when the record has no usable title.
 * `link` is always populated with a STABLE, per-record-unique value so the
 * writer's `source_url` dedup works even when the resource exposes no real URL.
 */
export function mapDataGovRecord(
  rec: Rec,
  aliases: ApiFieldAliases = {},
): NormalizedApiItem | null {
  const title = pick(rec, [aliases.title, ...DEFAULTS.title]);
  if (!title) return null;

  const date = pick(rec, [aliases.date, ...DEFAULTS.date]) || undefined;

  const summary =
    [
      pick(rec, [...DEFAULTS.org]),
      pick(rec, [...DEFAULTS.sector]),
      pick(rec, [...DEFAULTS.place]),
    ]
      .filter(Boolean)
      .join(' • ') || undefined;

  const explicitLink = pick(rec, [aliases.link, ...DEFAULTS.link]);
  const id = pick(rec, [aliases.id, ...DEFAULTS.id]);
  let link: string;
  if (explicitLink) {
    link = explicitLink;
  } else if (id) {
    link = `https://www.ncs.gov.in/job-seeker/Pages/JobDetails.aspx?jobid=${encodeURIComponent(id)}`;
  } else {
    // No URL and no id: synthesize a stable unique ref so items don't collapse
    // to one dedup key. Points at the NCS portal with a per-item fragment.
    link = `https://www.ncs.gov.in/#job-${shortHash(title + '|' + (date ?? ''))}`;
  }

  return { title, link, date, summary };
}
