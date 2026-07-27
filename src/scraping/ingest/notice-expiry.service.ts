import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../core/database/postgres.service';

/**
 * Daily expiry sweep (spec Phase 6). Flips `active` -> `expired` by age from
 * published_date, per type:
 *   - job / notification / admission        -> 90 days
 *   - admit_card / answer_key               -> 30 days (exam is over)
 *   - result / cutoff / merit_list / scholarship -> NEVER (reference content)
 * Notices with no published_date are left active (no age to measure).
 *
 * The type lists and intervals are hard-coded literals (never user input), and
 * the statement only ever narrows active rows — no SQL is built from external
 * data.
 */
@Injectable()
export class NoticeExpiryService {
  private readonly logger = new Logger(NoticeExpiryService.name);

  constructor(private readonly db: PostgresService) {}

  async run(): Promise<{ expired: number }> {
    const result = await this.db.query<{ id: string }>(
      `UPDATE notices
          SET status = 'expired', updated_at = now()
        WHERE status = 'active'
          AND published_date IS NOT NULL
          AND (
                (notice_type IN ('job','notification','admission')
                   AND published_date < (now() - interval '90 days'))
             OR (notice_type IN ('admit_card','answer_key')
                   AND published_date < (now() - interval '30 days'))
              )
        RETURNING id`,
    );
    const expired = result.rows.length;
    this.logger.log(`Expiry sweep: ${expired} notice(s) marked expired.`);
    return { expired };
  }
}
