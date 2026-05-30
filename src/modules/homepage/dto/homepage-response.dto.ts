export class SeoDto {
  metaTitle: string;
  metaDescription: string;
  metaImage?: { url: string };
  keywords?: string;
  canonicalURL?: string;
}

export class ButtonDto {
  label: string;
  href: string;
  variant: 'primary' | 'secondary' | 'ghost';
  openInNewTab?: boolean;
}

export class BadgeDto {
  text: string;
  color?: string;
}

export class HeroSectionDto {
  __component: 'sections.hero';
  title: string;
  subtitle?: string;
  backgroundImage?: { url: string };
  cta?: ButtonDto;
  secondaryCta?: ButtonDto;
  badgeText?: string;
  highlightedText?: string;
  activeLearners?: number;
  successRate?: number;
}

export class BestSellersSectionDto {
  __component: 'sections.best-sellers';
  title: string;
  subtitle?: string;
  products: ProductCardDto[];
}

export class LatestUpdatesSectionDto {
  __component: 'sections.latest-updates';
  title: string;
  subtitle?: string;
  updates: UpdateCardDto[];
}

export class JobHighlightsSectionDto {
  __component: 'sections.job-highlights';
  title: string;
  jobs: JobCardDto[];
}

export class CtaBannerSectionDto {
  __component: 'sections.cta-banner';
  title: string;
  subtitle?: string;
  button?: ButtonDto;
  secondaryButton?: ButtonDto;
}

export type SectionDto =
  | HeroSectionDto
  | BestSellersSectionDto
  | LatestUpdatesSectionDto
  | JobHighlightsSectionDto
  | CtaBannerSectionDto;

export class ProductCardDto {
  id: string | number;
  title: string;
  slug: string;
  price: number;
  discountedPrice?: number;
  thumbnail?: { url: string };
  badge?: BadgeDto;
}

export class UpdateCardDto {
  id: string | number;
  title: string;
  slug: string;
  publishedAt: string;
  thumbnail?: { url: string };
}

export class JobCardDto {
  id: string | number;
  title: string;
  shortDescription?: string;
  badgeDate?: string;
  link?: string;
}

export class HomepageResponseDto {
  seo?: SeoDto;
  sections: SectionDto[];
  globalSettings?: {
    siteName: string;
    logo?: { url: string };
    socialLinks?: { platform: string; url: string }[];
  };
}
