import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export type ScrapeJobStatus = 'running' | 'success' | 'error';

/**
 * One row per scraper source run — the monitoring/audit trail behind the admin
 * scraper dashboard. Written by ScrapeJobRecorder: a `running` row on start,
 * updated to `success`/`error` with counts + duration on finish.
 */
@Table({
  tableName: 'scrape_jobs',
  timestamps: true,
  underscored: true,
})
export class ScrapeJob extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({ type: DataType.TEXT })
  declare source: string;

  @Column({
    type: DataType.ENUM('running', 'success', 'error'),
    defaultValue: 'running',
  })
  declare status: ScrapeJobStatus;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'items_found' })
  declare itemsFound: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'items_inserted' })
  declare itemsInserted: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'items_skipped' })
  declare itemsSkipped: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
    field: 'duration_ms',
  })
  declare durationMs: number | null;

  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
  declare error: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: null,
    field: 'finished_at',
  })
  declare finishedAt: Date | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
