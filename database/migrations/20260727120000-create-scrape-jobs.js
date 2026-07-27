'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('scrape_jobs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      source: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('running', 'success', 'error'),
        allowNull: false,
        defaultValue: 'running',
      },
      items_found: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      items_inserted: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      items_skipped: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex('scrape_jobs', ['source']);
    await queryInterface.addIndex('scrape_jobs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('scrape_jobs');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_scrape_jobs_status";',
    );
  },
};
