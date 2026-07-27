import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { NOTICE_TYPES } from '../scraping/notice-type';
import type { NoticeType } from '../scraping/notice-type';

export type NoticeStatus = 'active' | 'expired';

/**
 * One row per aggregated government notice (job/result/admit_card/...). Single
 * table + enum, per the build spec — source-specific fields go in raw_fields
 * JSONB, only the columns we filter/sort on are first-class. Rows are inserted
 * by NoticeIngestService via raw `ON CONFLICT (dedupe_hash) DO NOTHING`; this
 * model backs reads (the public /notices API) and the expiry job's updates.
 */
@Table({
  tableName: 'notices',
  timestamps: true,
  underscored: true,
})
export class Notice extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'source_id' })
  declare sourceId: string;

  @Column({
    type: DataType.ENUM(...NOTICE_TYPES),
    allowNull: false,
    field: 'notice_type',
  })
  declare noticeType: NoticeType;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare title: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'org_name' })
  declare orgName: string;

  @Column({ type: DataType.TEXT, allowNull: false, field: 'source_url' })
  declare sourceUrl: string;

  // DATEONLY -> 'YYYY-MM-DD' string; nullable because many notices carry no
  // parseable date.
  @Column({ type: DataType.DATEONLY, allowNull: true, field: 'published_date' })
  declare publishedDate: string | null;

  @Column({ type: DataType.STRING, allowNull: false, field: 'dedupe_hash' })
  declare dedupeHash: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'raw_fields',
  })
  declare rawFields: Record<string, unknown>;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'seo_description' })
  declare seoDescription: string | null;

  @Column({
    type: DataType.ARRAY(DataType.TEXT),
    allowNull: true,
    field: 'seo_keywords',
  })
  declare seoKeywords: string[] | null;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'active' })
  declare status: NoticeStatus;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
