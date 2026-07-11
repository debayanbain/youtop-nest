import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { JobResultsService } from './job-results.service';

@Controller({ path: 'job-results', version: '1' })
export class JobResultsController {
  constructor(private readonly jobResultsService: JobResultsService) {}

  @Get()
  getAll() {
    return this.jobResultsService.getAll();
  }

  @Get(':slug')
  async getOne(@Param('slug') slug: string) {
    const item = await this.jobResultsService.getBySlug(slug);
    if (!item) {
      throw new NotFoundException('Job result not found');
    }
    return item;
  }
}
