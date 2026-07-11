export interface JobNewsDto {
  id: string | number;
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  publishedDate?: string;
  sourceLink?: string;
  category?: string;
  image: string;
  /** 'manual' | 'scraped' — origin badge for the UI/admin. */
  sourceType: string;
}
