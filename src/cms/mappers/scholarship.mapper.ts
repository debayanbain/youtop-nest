import { ScholarshipDto } from '../../modules/scholarships/dto/scholarship.dto';
import { MediaUrlHelper } from '../../common/helpers/media-url.helper';

/** Split a newline/comma-separated text field into a clean string[]. */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v !== 'string' || !v.trim()) return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Strapi `scholarship` (snake_case, nested media/component) -> camelCase DTO. */
export class ScholarshipMapper {
  static map(p: any): ScholarshipDto {
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description ?? undefined,
      provider: p.provider ?? undefined,
      logo: MediaUrlHelper.image(p.logo?.url),
      amount: p.amount ?? undefined,
      awardDetails: p.award_details ?? undefined,
      eligibilitySummary: p.eligibility_summary ?? undefined,
      deadline: p.deadline ?? undefined,
      daysRemaining:
        p.days_remaining != null ? Number(p.days_remaining) : undefined,
      type: p.type ?? undefined,
      state: p.state ?? undefined,
      category: p.category ?? undefined,
      // Strapi enum can't hold a space; expand it for the UI.
      status: p.status === 'AlwaysOpen' ? 'Always Open' : (p.status ?? 'Live'),
      domain: p.domain ?? undefined,
      eligibility: toList(p.eligibility),
      benefits: toList(p.benefits),
      applicationLink: p.application_link ?? undefined,
      featured: !!p.featured,
      sourceType: p.source_meta?.source_type ?? 'manual',
    };
  }
}
