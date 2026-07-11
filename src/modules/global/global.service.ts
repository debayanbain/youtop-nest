import { Injectable, Logger } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { GlobalSettingsMapper } from '../../cms/mappers/global-settings.mapper';
import { GlobalSettingsDto } from './dto/global-settings.dto';

@Injectable()
export class GlobalService {
  private readonly logger = new Logger(GlobalService.name);

  constructor(private readonly strapiService: StrapiService) {}

  async getSettings(): Promise<GlobalSettingsDto> {
    // Fetch independently so a 404 on one single type doesn't blank the other.
    const [global, navigation] = await Promise.all([
      this.strapiService
        .getSingle<any>(
          '/global-setting?populate[logo]=true&populate[favicon]=true&populate[social_links]=true',
          300, // 5 minute TTL
        )
        .catch((err) => {
          this.logger.warn(
            'Global settings not found in Strapi',
            (err as Error)?.message,
          );
          return null;
        }),
      this.strapiService
        .getSingle<any>(
          '/navigation?populate[header_links]=true&populate[footer_columns][populate][links]=true',
          300,
        )
        .catch((err) => {
          this.logger.warn(
            'Navigation not found in Strapi',
            (err as Error)?.message,
          );
          return null;
        }),
    ]);

    // Always return a well-formed object so the header/footer never break.
    return GlobalSettingsMapper.map(global, navigation);
  }
}
