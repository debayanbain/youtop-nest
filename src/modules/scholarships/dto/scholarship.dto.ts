export interface ScholarshipDto {
  id: string | number;
  slug: string;
  title: string;
  description?: string;
  provider?: string;
  logo: string;
  amount?: string;
  awardDetails?: string;
  eligibilitySummary?: string;
  deadline?: string;
  daysRemaining?: number;
  type?: string;
  state?: string;
  category?: string;
  status: string;
  domain?: string;
  eligibility: string[];
  benefits: string[];
  applicationLink?: string;
  featured: boolean;
  /** 'manual' | 'scraped' — origin badge for the UI/admin. */
  sourceType: string;
}
