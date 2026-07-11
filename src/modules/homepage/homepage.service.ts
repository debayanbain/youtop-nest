import { Injectable, Logger } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { HomepageResponseDto } from './dto/homepage-response.dto';
import { HomepageMapper } from '../../cms/mappers/homepage.mapper';

@Injectable()
export class HomepageService {
  private readonly logger = new Logger(HomepageService.name);

  constructor(private readonly strapiService: StrapiService) {}

  async getHomepage(): Promise<HomepageResponseDto> {
    // Fetch independently so a 404 on one doesn't crash the whole endpoint
    const [homepageData, globalData] = await Promise.all([
      this.strapiService
        .getSingle<any>(
          '/home-page?' +
            [
              'populate[sections][on][sections.hero][populate][hero_image]=true',
              'populate[sections][on][sections.best-sellers][populate][products][populate][thumbnail]=true',
              'populate[sections][on][sections.latest-updates][populate][updates]=true',
              'populate[sections][on][sections.job-highlights][populate][jobs]=true',
              'populate[sections][on][sections.cta-banner]=true',
            ].join('&'),
          300, // 5 minutes TTL
        )
        .catch((err) => {
          this.logger.error(
            'Failed to fetch home-page from Strapi',
            err?.message,
          );
          return null;
        }),
      this.strapiService
        .getSingle<any>(
          '/global-setting?populate[logo]=true&populate[favicon]=true&populate[social_links]=true',
          300,
        )
        .catch((err) => {
          this.logger.warn('Global settings not found in Strapi', err?.message);
          return null;
        }),
    ]);

    return {
      ...homepageData,
      globalSettings: globalData,
    };
  }
}
