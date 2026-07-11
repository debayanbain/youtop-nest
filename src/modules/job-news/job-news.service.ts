import { Injectable } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { JobNewsMapper } from '../../cms/mappers/job-news.mapper';
import { JobNewsDto } from './dto/job-news.dto';

@Injectable()
export class JobNewsService {
  constructor(private readonly strapiService: StrapiService) {}

  // Strapi pluralName for the `job-news` type is `job-news-items`.
  async getAll(): Promise<JobNewsDto[]> {
    const items = await this.strapiService.getCollection<any>(
      '/job-news-items?filters[active][$eq]=true&populate=*&sort=published_date:desc',
      60,
    );
    return items.map((p) => JobNewsMapper.map(p));
  }

  async getBySlug(slug: string): Promise<JobNewsDto | null> {
    const items = await this.strapiService.getCollection<any>(
      `/job-news-items?filters[slug][$eq]=${slug}&filters[active][$eq]=true&populate=*`,
      60,
    );
    return items.length ? JobNewsMapper.map(items[0]) : null;
  }
}
