import { JobResultDto } from '../../modules/job-results/dto/job-result.dto';
import { MediaUrlHelper } from '../../common/helpers/media-url.helper';

/** Strapi `job-result` (snake_case, nested media/component) -> camelCase DTO. */
export class JobResultMapper {
  static map(p: any): JobResultDto {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      organization: p.organization ?? undefined,
      postName: p.post_name ?? undefined,
      resultDate: p.result_date ?? undefined,
      description: p.description ?? undefined,
      officialLink: p.official_link ?? undefined,
      pdfUrl: MediaUrlHelper.resolve(p.result_pdf?.url) || null,
      image: MediaUrlHelper.image(p.thumbnail?.url),
      sourceType: p.source_meta?.source_type ?? 'manual',
      kind: p.kind ?? undefined,
      tags: p.tags ?? undefined,
      seoDescription: p.seo_description ?? undefined,
      seoKeywords: p.seo_keywords ?? undefined,
    };
  }
}
