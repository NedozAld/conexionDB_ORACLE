const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('XE', process.env.DB_USER || 'hr', process.env.DB_PASSWORD || 'hr', {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'oracle',
    port: process.env.DB_PORT || 1521,
    dialectOptions: {
        connectString: `${process.env.DB_HOST || 'localhost'}/XE`,
    },
    logging: false,
});

module.exports = sequelize;