import * as cheerio from 'cheerio';

/**
 * Structured fields extracted from a job-posting detail page. Everything is
 * optional — a posting page may omit any of them, and callers store only what
 * came back.
 */
export interface JobPostingDetails {
  organization?: string;
  postName?: string;
  vacancies?: string;
  qualification?: string;
  ageLimit?: string;
  salary?: string;
  applicationFee?: string;
  lastDate?: string; // ISO yyyy-mm-dd
  eligibility?: string;
  applyLink?: string;
  notificationLink?: string;
  officialWebsite?: string;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** yyyy-mm-dd from "24-07-2026", "24 July 2026", etc.; undefined if unparseable. */
function toIso(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  const dmy = s.match(/(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const t = new Date(s);
  return isNaN(t.getTime()) ? undefined : t.toISOString().slice(0, 10);
}

/**
 * Parser for FreeJobAlert-style posting pages (templated WordPress: an Overview
 * table of label→value rows, a fee table, and an Important Links table whose
 * value cells hold anchors). Label matching is fuzzy so minor wording changes
 * ("No of Posts" vs "Total Posts") still resolve. Returns {} on unparseable
 * input rather than throwing.
 */
export function parseFreejobalert(
  html: string,
  pageUrl?: string,
): JobPostingDetails {
  const $ = cheerio.load(html);

  // 1) All "label => value" table rows, keyed lowercase.
  const labels: Record<string, string> = {};
  // 2) Rows whose value cell contains a link: label => href.
  const links: Record<string, string> = {};
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td, th');
    if (cells.length < 2) return;
    const key = clean($(cells[0]).text()).toLowerCase();
    const valCell = $(cells[1]);
    const val = clean(valCell.text());
    if (key && val && !(key in labels)) labels[key] = val;
    const href = valCell.find('a[href]').attr('href');
    if (key && href && href.startsWith('http') && !(key in links)) {
      links[key] = href;
    }
  });

  const pick = (...needles: string[]): string | undefined => {
    for (const n of needles) {
      const hit = Object.keys(labels).find((k) => k.includes(n));
      if (hit) return labels[hit];
    }
    return undefined;
  };
  const pickLink = (...needles: string[]): string | undefined => {
    for (const n of needles) {
      const hit = Object.keys(links).find((k) => k.includes(n));
      if (hit) return links[hit];
    }
    return undefined;
  };
  // Fee only from a money-looking value, so an age-relaxation row like
  // "General => 33 years" never gets misread as the application fee.
  const isMoney = (v: string) => /(rs\.?|₹|inr)\s*\.?\s*\d|\d+\s*\/-/i.test(v);
  const pickFee = (): string | undefined => {
    for (const n of [
      'application fee',
      'fee',
      'general/obc',
      'ur/obc',
      'general',
    ]) {
      const hit = Object.keys(labels).find(
        (k) => k.includes(n) && isMoney(labels[k]),
      );
      if (hit) return labels[hit];
    }
    return undefined;
  };

  // Text under the "Eligibility Criteria" heading (until the next heading).
  let eligibility: string | undefined;
  const elig = $('h2, h3').filter((_, h) =>
    /eligibility|qualification/i.test($(h).text()),
  );
  if (elig.length) {
    const parts: string[] = [];
    let node = elig.first().next();
    for (let i = 0; i < 8 && node.length; i++) {
      if (/^h[1-4]$/i.test(node.prop('tagName') || '')) break;
      const t = clean(node.text());
      if (t) parts.push(t);
      node = node.next();
    }
    eligibility = parts.join(' ').slice(0, 1500) || undefined;
  }

  const out: JobPostingDetails = {
    organization: pick('company name', 'organization', 'organisation', 'board'),
    postName: pick('post name', 'name of post', 'designation'),
    vacancies: pick('no of post', 'no. of post', 'total post', 'vacanc'),
    qualification: pick('qualification', 'eligibility'),
    ageLimit: pick('age limit', 'age'),
    salary: pick('salary', 'pay scale', 'pay'),
    applicationFee: pickFee(),
    lastDate: toIso(pick('last date', 'closing date', 'end date')),
    eligibility,
    applyLink: pickLink('application form', 'apply online', 'apply'),
    notificationLink: pickLink('notification', 'advertisement'),
    officialWebsite: pickLink('official website', 'website'),
  };

  // Last resort: if the page exposed no official/apply/notification link at all,
  // keep the source page itself so the user still has something to click.
  if (
    !out.applyLink &&
    !out.notificationLink &&
    !out.officialWebsite &&
    pageUrl
  ) {
    out.officialWebsite = pageUrl;
  }

  // Drop empty keys so callers don't write blank fields.
  for (const k of Object.keys(out) as (keyof JobPostingDetails)[]) {
    if (!out[k]) delete out[k];
  }
  return out;
}
