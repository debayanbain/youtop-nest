import {
  HomepageResponseDto,
  SectionDto,
  ProductCardDto,
  UpdateCardDto,
  JobCardDto,
} from '../../modules/homepage/dto/homepage-response.dto';
import { MediaUrlHelper } from '../../common/helpers/media-url.helper';

export class HomepageMapper {
  static mapToDto(homepageData: any, globalData: any): HomepageResponseDto {
    const rawSections =
      homepageData?.sections ?? homepageData?.data?.sections ?? [];

    const sections = rawSections
      .map((section: any) => this.mapSection(section))
      .filter((s: SectionDto | null): s is SectionDto => s !== null);

    const seo =
      homepageData?.seo_title || homepageData?.seo_description
        ? {
            metaTitle: homepageData.seo_title || '',
            metaDescription: homepageData.seo_description || '',
          }
        : undefined;

    return {
      seo,
      sections,
      globalSettings: this.mapGlobal(globalData),
    };
  }

  private static mapSection(section: any): SectionDto | null {
    if (!section || !section.__component) {
      return null;
    }

    switch (section.__component) {
      case 'sections.hero':
        return {
          __component: 'sections.hero',
          title: section.heading ?? '',
          subtitle: section.subheading,
          backgroundImage: section.hero_image
            ? {
                url: MediaUrlHelper.resolve(
                  section.hero_image.url ??
                    section.hero_image.data?.attributes?.url,
                ),
              }
            : undefined,
          cta: section.primary_button_text
            ? {
                label: section.primary_button_text,
                href: section.primary_button_link ?? '#',
                variant: 'primary',
              }
            : undefined,
          secondaryCta: section.secondary_button_text
            ? {
                label: section.secondary_button_text,
                href: section.secondary_button_link ?? '#',
                variant: 'secondary',
              }
            : undefined,
          badgeText: section.badge_text,
          highlightedText: section.highlighted_text,
          activeLearners: section.active_learners
            ? Number(section.active_learners)
            : undefined,
          successRate: section.success_rate
            ? Number(section.success_rate)
            : undefined,
        };

      case 'sections.best-sellers':
        return {
          __component: 'sections.best-sellers',
          title: section.title ?? 'Best Sellers',
          subtitle: section.subtitle,
          products: (section.products ?? []).map(
            (p: any): ProductCardDto => ({
              id: p.id,
              title: p.title ?? '',
              slug: p.slug ?? '',
              price: p.price ? Number(p.price) : 0,
              discountedPrice: p.old_price ? Number(p.old_price) : undefined,
              thumbnail: p.thumbnail
                ? {
                    url: MediaUrlHelper.resolve(
                      p.thumbnail.url ?? p.thumbnail.data?.attributes?.url,
                    ),
                  }
                : undefined,
              badge: p.badge ? { text: p.badge } : undefined,
            }),
          ),
        };

      case 'sections.latest-updates':
        return {
          __component: 'sections.latest-updates',
          title: section.title ?? 'Latest Updates',
          subtitle: section.subtitle,
          updates: (section.updates ?? []).map(
            (u: any): UpdateCardDto => ({
              id: u.id,
              title: u.title ?? '',
              slug: u.slug ?? '',
              publishedAt: u.publish_date ?? '',
            }),
          ),
        };

      case 'sections.job-highlights':
        return {
          __component: 'sections.job-highlights',
          title: section.title ?? 'Job Highlights',
          jobs: (section.jobs ?? []).map(
            (j: any): JobCardDto => ({
              id: j.id,
              title: j.title ?? '',
              shortDescription: j.short_description,
              badgeDate: j.badge_date,
              link: j.link,
            }),
          ),
        };

      case 'sections.cta-banner':
        return {
          __component: 'sections.cta-banner',
          title: section.heading ?? '',
          subtitle: section.subheading,
          button: section.primary_button_text
            ? {
                label: section.primary_button_text,
                href: section.primary_button_link ?? '#',
                variant: 'primary',
              }
            : undefined,
          secondaryButton: section.secondary_button_text
            ? {
                label: section.secondary_button_text,
                href: section.secondary_button_link ?? '#',
                variant: 'secondary',
              }
            : undefined,
        };

      default:
        return null;
    }
  }

  private static mapGlobal(data: any) {
    if (!data) return undefined;
    return {
      siteName: data.siteName ?? '',
      logo: data.logo
        ? {
            url: MediaUrlHelper.resolve(
              data.logo.url ?? data.logo.data?.attributes?.url,
            ),
          }
        : undefined,
      socialLinks: (data.socialLinks ?? []).map((link: any) => ({
        platform: link.platform ?? '',
        url: link.url ?? '',
      })),
    };
  }
}
