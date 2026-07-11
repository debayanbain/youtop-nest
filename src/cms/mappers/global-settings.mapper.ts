import {
  GlobalSettingsDto,
  SocialLinkDto,
  NavLinkDto,
  FooterColumnDto,
} from '../../modules/global/dto/global-settings.dto';
import { MediaUrlHelper } from '../../common/helpers/media-url.helper';

/**
 * Strapi `global-setting` + `navigation` (snake_case, nested media) -> one
 * clean camelCase DTO. Uses `resolve()` (not `image()`) for logo/favicon: an
 * absent brand asset should be `null` so the frontend can fall back to its own
 * mark, not a generic image placeholder.
 */
export class GlobalSettingsMapper {
  private static media(m: any): string | null {
    const url = m?.url ?? m?.data?.attributes?.url;
    return MediaUrlHelper.resolve(url) || null;
  }

  private static navLinks(arr: any): NavLinkDto[] {
    return Array.isArray(arr)
      ? arr
          .filter((l: any) => l?.label && l?.href)
          .map((l: any) => ({ label: String(l.label), href: String(l.href) }))
      : [];
  }

  static map(global: any, navigation?: any): GlobalSettingsDto {
    const socialLinks: SocialLinkDto[] = Array.isArray(global?.social_links)
      ? global.social_links
          .filter((s: any) => s?.url)
          .map((s: any) => ({
            platform: String(s.platform ?? ''),
            url: String(s.url),
          }))
      : [];

    const footerColumns: FooterColumnDto[] = Array.isArray(
      navigation?.footer_columns,
    )
      ? navigation.footer_columns
          .filter((c: any) => c?.title)
          .map((c: any) => ({
            title: String(c.title),
            links: GlobalSettingsMapper.navLinks(c.links),
          }))
      : [];

    return {
      siteName: global?.site_name ?? '',
      logo: GlobalSettingsMapper.media(global?.logo),
      favicon: GlobalSettingsMapper.media(global?.favicon),
      socialLinks,
      headerLinks: GlobalSettingsMapper.navLinks(navigation?.header_links),
      footerColumns,
    };
  }
}
