import { Controller, Get } from '@nestjs/common';
import { GlobalService } from './global.service';

@Controller({ path: 'global-settings', version: '1' })
export class GlobalController {
  constructor(private readonly globalService: GlobalService) {}

  /** Public: site-wide settings for the header, footer, and document head. */
  @Get()
  getSettings() {
    return this.globalService.getSettings();
  }
}
