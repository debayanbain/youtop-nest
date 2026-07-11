export interface SocialLinkDto {
  platform: string;
  url: string;
}

export interface NavLinkDto {
  label: string;
  href: string;
}

export interface FooterColumnDto {
  title: string;
  links: NavLinkDto[];
}

/**
 * Site-wide settings sourced from the Strapi `global-setting` single type,
 * merged with the `navigation` single type. Media fields are resolved to
 * absolute URLs (or null when unset) so the frontend can render them directly.
 */
export interface GlobalSettingsDto {
  siteName: string;
  logo: string | null;
  favicon: string | null;
  socialLinks: SocialLinkDto[];
  headerLinks: NavLinkDto[];
  footerColumns: FooterColumnDto[];
}
