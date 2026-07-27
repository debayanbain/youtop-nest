import { Injectable, NotFoundException } from '@nestjs/common';
import { Op, literal } from 'sequelize';
import { PostgresService } from '../../core/database/postgres.service';
import { NOTICE_TYPES } from '../../scraping/notice-type';
import { Notice } from '../../models/notice.model';
import { ListNoticesDto } from './dto/list-notices.dto';

/**
 * Read model for the public notice board. All access goes through the Sequelize
 * model (parameterized) — the only externally-influenced values are `type`
 * (enum-whitelisted in the DTO), `orgName` (bound via Op.iLike, never
 * concatenated), and paging ints. Sort order is fixed server-side, so there is
 * no user-controlled ORDER BY.
 */
@Injectable()
export class NoticesService {
  constructor(private readonly db: PostgresService) {}

  async list(q: ListNoticesDto): Promise<{
    items: Notice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    await this.db.getConnection();

    const where: Record<string | symbol, unknown> = {};
    if (q.type) where.noticeType = q.type;
    if (q.orgName) where.orgName = { [Op.iLike]: q.orgName };
    if (q.status !== 'all') where.status = q.status; // 'active' (default) | 'expired'
    if (q.q) {
      // Escape LIKE wildcards in user input so `%`/`_` are literal, then match
      // title OR org_name. The value is still bound (parameterized) by Sequelize.
      const term = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: term } },
        { orgName: { [Op.iLike]: term } },
      ];
    }

    const { rows, count } = await this.db.models.Notice.findAndCountAll({
      where,
      // Newest published first; undated notices sink to the bottom.
      order: literal('published_date DESC NULLS LAST, created_at DESC'),
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });

    return {
      items: rows,
      total: count,
      page: q.page,
      limit: q.limit,
      totalPages: Math.ceil(count / q.limit) || 0,
    };
  }

  async findOne(id: string): Promise<Notice> {
    await this.db.getConnection();
    const notice = await this.db.models.Notice.findByPk(id);
    if (!notice) throw new NotFoundException('Notice not found');
    return notice;
  }

  /** Enum list + active-notice counts per type, for building the frontend nav. */
  async typeCounts(): Promise<{
    types: { type: string; count: number }[];
    total: number;
  }> {
    const rows = await this.db.select<{ type: string; count: number }>(
      `SELECT notice_type AS type, count(*)::int AS count
         FROM notices
        WHERE status = 'active'
        GROUP BY notice_type`,
    );
    const map = new Map(rows.map((r) => [r.type, r.count]));
    const types = NOTICE_TYPES.map((type) => ({
      type,
      count: map.get(type) ?? 0,
    }));
    const total = types.reduce((sum, t) => sum + t.count, 0);
    return { types, total };
  }
}
