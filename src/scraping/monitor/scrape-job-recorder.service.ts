import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../core/database/postgres.service';
import type { ScrapeJob, ScrapeJobStatus } from '../../models/scrape-job.model';

export interface ScrapeJobFinish {
  status: Extract<ScrapeJobStatus, 'success' | 'error'>;
  itemsFound?: number;
  itemsInserted?: number;
  itemsSkipped?: number;
  durationMs?: number;
  error?: string | null;
}

/**
 * Writes the scrape_jobs audit trail: a `running` row when a source starts, then
 * an update to `success`/`error` with counts + duration when it finishes. Every
 * DB call is wrapped so a monitoring failure can never break the actual scrape.
 */
@Injectable()
export class ScrapeJobRecorder {
  private readonly logger = new Logger(ScrapeJobRecorder.name);

  constructor(private readonly db: PostgresService) {}

  async start(source: string): Promise<number | null> {
    try {
      await this.db.getConnection();
      const row = await this.db.models.ScrapeJob.create({
        source,
        status: 'running',
      });
      return row.id;
    } catch (err) {
      this.logger.warn(
        `scrape_jobs start failed for ${source}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async finish(id: number | null, patch: ScrapeJobFinish): Promise<void> {
    if (id == null) return;
    try {
      await this.db.getConnection();
      await this.db.models.ScrapeJob.update(
        { ...patch, finishedAt: new Date() },
        { where: { id } },
      );
    } catch (err) {
      this.logger.warn(
        `scrape_jobs finish failed for id ${id}: ${(err as Error).message}`,
      );
    }
  }

  async recent(limit = 100): Promise<ScrapeJob[]> {
    await this.db.getConnection();
    return this.db.models.ScrapeJob.findAll({
      order: [['createdAt', 'DESC']],
      limit,
    });
  }
}
