import { Injectable } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { JobResultMapper } from '../../cms/mappers/job-result.mapper';
import { JobResultDto } from './dto/job-result.dto';

@Injectable()
export class JobResultsService {
  constructor(private readonly strapiService: StrapiService) {}

  async getAll(): Promise<JobResultDto[]> {
    const items = await this.strapiService.getCollection<any>(
      '/job-results?filters[active][$eq]=true&populate=*&sort=result_date:desc',
      60,
    );
    return items.map((p) => JobResultMapper.map(p));
  }

  async getBySlug(slug: string): Promise<JobResultDto | null> {
    const items = await this.strapiService.getCollection<any>(
      `/job-results?filters[slug][$eq]=${slug}&filters[active][$eq]=true&populate=*`,
      60,
    );
    return items.length ? JobResultMapper.map(items[0]) : null;
  }
}
