export interface JobResultDto {
  id: string | number;
  title: string;
  slug: string;
  organization?: string;
  postName?: string;
  resultDate?: string;
  description?: string;
  officialLink?: string;
  pdfUrl: string | null;
  image: string;
  /** 'manual' | 'scraped' — origin badge for the UI/admin. */
  sourceType: string;
}
