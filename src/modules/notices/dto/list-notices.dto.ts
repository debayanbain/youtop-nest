import {
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NOTICE_TYPES } from '../../../scraping/notice-type';
import type { NoticeType } from '../../../scraping/notice-type';

/** status filter values accepted by the list endpoint. */
export const NOTICE_STATUS_FILTERS = ['active', 'expired', 'all'] as const;
export type NoticeStatusFilter = (typeof NOTICE_STATUS_FILTERS)[number];

/**
 * Validated + coerced query params for GET /notices. The global
 * ValidationPipe({ whitelist: true, transform: true }) strips unknown keys and
 * coerces page/limit to numbers. `type` and `status` are whitelisted against
 * fixed enums (no free-form value ever reaches SQL); `limit` is hard-capped.
 */
export class ListNoticesDto {
  @IsOptional()
  @IsIn(NOTICE_TYPES)
  type?: NoticeType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  orgName?: string;

  /** Free-text search over title + org_name (case-insensitive). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(NOTICE_STATUS_FILTERS)
  status: NoticeStatusFilter = 'active';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
