import { Injectable } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { ScholarshipMapper } from '../../cms/mappers/scholarship.mapper';
import { ScholarshipDto } from './dto/scholarship.dto';

@Injectable()
export class ScholarshipsService {
  constructor(private readonly strapiService: StrapiService) {}

  async getAll(): Promise<ScholarshipDto[]> {
    const items = await this.strapiService.getCollection<any>(
      '/scholarships?filters[active][$eq]=true&populate=*&sort=createdAt:desc',
      60,
    );
    return items.map((p) => ScholarshipMapper.map(p));
  }

  async getBySlug(slug: string): Promise<ScholarshipDto | null> {
    const items = await this.strapiService.getCollection<any>(
      `/scholarships?filters[slug][$eq]=${slug}&filters[active][$eq]=true&populate=*`,
      60,
    );
    return items.length ? ScholarshipMapper.map(items[0]) : null;
  }
}
