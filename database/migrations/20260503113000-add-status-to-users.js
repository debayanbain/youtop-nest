/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'status');
    // In PostgreSQL, dropping the column doesn't drop the ENUM type.
    // We explicitly drop it to keep the database clean.
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_users_status";',
    );
  },
};
