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
    };
  }
}
