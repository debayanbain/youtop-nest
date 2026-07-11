import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ScholarshipsService } from './scholarships.service';

@Controller({ path: 'scholarships', version: '1' })
export class ScholarshipsController {
  constructor(private readonly scholarshipsService: ScholarshipsService) {}

  @Get()
  getAll() {
    return this.scholarshipsService.getAll();
  }

  @Get(':slug')
  async getOne(@Param('slug') slug: string) {
    const item = await this.scholarshipsService.getBySlug(slug);
    if (!item) {
      throw new NotFoundException('Scholarship not found');
    }
    return item;
  }
}
