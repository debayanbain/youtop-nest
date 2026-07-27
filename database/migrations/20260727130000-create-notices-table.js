'use strict';

/**
 * Gov Notice Aggregator — single `notices` table (one enum, not nine tables).
 * Only title/org_name/published_date/notice_type/source_url are first-class
 * columns (the only fields we filter/sort on); everything source-specific lives
 * in raw_fields JSONB. dedupe_hash is computed in app code and carries a UNIQUE
 * constraint so ingest can `ON CONFLICT (dedupe_hash) DO NOTHING`.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // Enum type is created idempotently so a re-run after a partial failure
    // (and the migrate:down -> migrate:up reversibility check) stays clean.
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notice_type') THEN
          CREATE TYPE notice_type AS ENUM (
            'job', 'result', 'admit_card', 'answer_key',
            'notification', 'scholarship', 'admission', 'cutoff', 'merit_list'
          );
        END IF;
      END
      $$;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id VARCHAR NOT NULL,
        notice_type notice_type NOT NULL,
        title TEXT NOT NULL,
        org_name VARCHAR NOT NULL,
        source_url TEXT NOT NULL,
        published_date DATE,
        dedupe_hash VARCHAR NOT NULL UNIQUE,
        raw_fields JSONB DEFAULT '{}',
        seo_description TEXT,
        seo_keywords TEXT[],
        status VARCHAR NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_notices_type_date ON notices (notice_type, published_date DESC);`,
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_notices_source ON notices (source_id);`,
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_notices_status ON notices (status);`,
    );
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`DROP TABLE IF EXISTS notices;`);
    await sequelize.query(`DROP TYPE IF EXISTS notice_type;`);
  },
};
