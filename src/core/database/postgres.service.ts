import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { postgresConfig } from '../../common/config/database/postgres.config';
import { ALL_MODELS, Models } from './models.registry';

/**
 * Types for database operations
 */
export type ExtensionName = string;
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}
export type TransactionCallback<T> = (
  execute: (
    sql: string,
    replacements?: Record<string, unknown>,
  ) => Promise<unknown>,
) => Promise<T>;

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private sequelize: Sequelize | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<Sequelize> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.getConnection();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Get the Sequelize connection instance.
   * Lazily connects on first call using singleton pattern.
   */
  async getConnection(): Promise<Sequelize> {
    if (this.isConnected && this.sequelize) {
      return this.sequelize;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.connect();

    try {
      return await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async connect(): Promise<Sequelize> {
    const { uri, ...sequelizeConfig } = postgresConfig(this.configService);

    try {
      // Initialize Sequelize with URI as the first argument
      this.sequelize = new Sequelize(uri as string, {
        ...sequelizeConfig,
        models: ALL_MODELS,
      });

      await this.sequelize.authenticate();

      this.isConnected = true;
      this.isConnecting = false;
      this.logger.log('🐘 PostgreSQL connected successfully');

      return this.sequelize;
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      this.sequelize = null;
      this.logger.error('🐘 PostgreSQL connection failed', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.sequelize && this.isConnected) {
      await this.sequelize.close();
      this.isConnected = false;
      this.sequelize = null;
      this.logger.log('🔌 PostgreSQL disconnected');
    }
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    replacements?: Record<string, unknown>,
  ): Promise<QueryResult<T>> {
    const sequelize = await this.getConnection();
    const [rows, metadata] = await sequelize.query(sql, {
      type: QueryTypes.RAW,
      replacements,
    });
    return {
      rows: rows as T[],
      rowCount: Array.isArray(rows)
        ? rows.length
        : (metadata as { rowCount?: number })?.rowCount || 0,
    };
  }

  async execute(
    sql: string,
    replacements?: Record<string, unknown>,
  ): Promise<void> {
    const sequelize = await this.getConnection();
    await sequelize.query(sql, {
      type: QueryTypes.RAW,
      replacements,
    });
  }

  async select<T = Record<string, unknown>>(
    sql: string,
    replacements?: Record<string, unknown>,
  ): Promise<T[]> {
    const sequelize = await this.getConnection();
    return (await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements,
    })) as T[];
  }

  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const sequelize = await this.getConnection();
    const t = await sequelize.transaction();

    try {
      const execute = async (
        sql: string,
        replacements?: Record<string, unknown>,
      ): Promise<unknown> => {
        return sequelize.query(sql, {
          type: QueryTypes.RAW,
          replacements,
          transaction: t,
        });
      };

      const result = await callback(execute);
      await t.commit();
      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  getSequelize(): Sequelize | null {
    return this.sequelize;
  }

  get models(): Models {
    return Models;
  }
}
