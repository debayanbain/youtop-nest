import { JobNewsDto } from '../../modules/job-news/dto/job-news.dto';
import { MediaUrlHelper } from '../../common/helpers/media-url.helper';

/** Strapi `job-news` (snake_case, nested media/component) -> camelCase DTO. */
export class JobNewsMapper {
  static map(p: any): JobNewsDto {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      summary: p.summary ?? undefined,
      content: p.content ?? undefined,
      publishedDate: p.published_date ?? undefined,
      sourceLink: p.source_link ?? undefined,
      category: p.category ?? undefined,
      image: MediaUrlHelper.image(p.thumbnail?.url),
      sourceType: p.source_meta?.source_type ?? 'manual',
      isPosting: p.is_posting ?? false,
      organization: p.organization ?? undefined,
      vacancies: p.vacancies ?? undefined,
      qualification: p.qualification ?? undefined,
      eligibility: p.eligibility ?? undefined,
      ageLimit: p.age_limit ?? undefined,
      salary: p.salary ?? undefined,
      applicationFee: p.application_fee ?? undefined,
      lastDate: p.last_date ?? undefined,
      applyLink: p.apply_link ?? undefined,
      notificationLink: p.notification_link ?? undefined,
      officialWebsite: p.official_website ?? undefined,
      tags: p.tags ?? undefined,
      seoDescription: p.seo_description ?? undefined,
      seoKeywords: p.seo_keywords ?? undefined,
    };
  }
}
