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
  /** True when this row is an actual vacancy posting (enriched), not news. */
  isPosting: boolean;
  organization?: string;
  vacancies?: string;
  qualification?: string;
  eligibility?: string;
  ageLimit?: string;
  salary?: string;
  applicationFee?: string;
  lastDate?: string;
  applyLink?: string;
  notificationLink?: string;
  officialWebsite?: string;
  tags?: string;
  seoDescription?: string;
  seoKeywords?: string;
}
