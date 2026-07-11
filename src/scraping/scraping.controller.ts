import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ScrapingProducer } from './scraping.producer';

/**
 * Admin-only manual triggers. The actual scraping runs on the BullMQ worker;
 * these endpoints just enqueue a job and return immediately.
 */
@Controller({ path: 'admin/scrape', version: '1' })
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('admin')
export class ScrapingController {
  constructor(private readonly producer: ScrapingProducer) {}

  @Post()
  async scrapeAll() {
    await this.producer.triggerAll();
    return { queued: 'scrape-all' };
  }

  @Post(':source')
  async scrapeSource(@Param('source') source: string) {
    await this.producer.triggerSource(source);
    return { queued: 'scrape-source', source };
  }
}
