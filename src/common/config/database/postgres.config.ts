// 1. Change the import to @nestjs/sequelize
import { SequelizeModuleOptions } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';

export const postgresConfig = (
  configService: ConfigService,
): SequelizeModuleOptions => {
  // 2. Update return type here
  const dbUrl = configService.getOrThrow<string>('DATABASE_URL');

  const uri = dbUrl.includes('?')
    ? `${dbUrl}&uselibpqcompat=true`
    : `${dbUrl}?uselibpqcompat=true`;

  return {
    dialect: 'postgres',
    uri, // Now 'uri' is recognized!
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: configService.get<string>('NODE_ENV') === 'development',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  };
};
