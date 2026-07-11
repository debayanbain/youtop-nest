import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { JobNewsService } from './job-news.service';

@Controller({ path: 'job-news', version: '1' })
export class JobNewsController {
  constructor(private readonly jobNewsService: JobNewsService) {}

  @Get()
  getAll() {
    return this.jobNewsService.getAll();
  }

  @Get(':slug')
  async getOne(@Param('slug') slug: string) {
    const item = await this.jobNewsService.getBySlug(slug);
    if (!item) {
      throw new NotFoundException('Job news not found');
    }
    return item;
  }
}
