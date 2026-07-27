import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ScrapingProducer } from './scraping.producer';
import { ScrapeJobRecorder } from './monitor/scrape-job-recorder.service';

/**
 * Admin-only manual triggers + run history. Triggers enqueue a BullMQ job and
 * return immediately; `GET jobs` powers the scraper monitoring dashboard.
 */
@Controller({ path: 'admin/scrape', version: '1' })
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('admin')
export class ScrapingController {
  constructor(
    private readonly producer: ScrapingProducer,
    private readonly recorder: ScrapeJobRecorder,
  ) {}

  @Post()
  async scrapeAll() {
    await this.producer.triggerAll();
    return { queued: 'scrape-all' };
  }

  /** Recent scrape runs (newest first) for the admin dashboard. */
  @Get('jobs')
  async jobs() {
    return this.recorder.recent(100);
  }

  @Post(':source')
  async scrapeSource(@Param('source') source: string) {
    await this.producer.triggerSource(source);
    return { queued: 'scrape-source', source };
  }
}
