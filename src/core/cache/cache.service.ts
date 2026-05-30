import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);
  private readonly keyPrefix = 'youtop:';

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      this.logger.log('Initializing Redis using REDIS_URL');
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      });
    } else {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      this.logger.log(`Initializing Redis using host: ${host}, port: ${port}`);
      this.redis = new Redis({
        host,
        port,
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
      });
    }

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });

    this.redis.on('connect', () => {
      this.logger.log('🐘 Redis connected successfully');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.redis.get(this.keyPrefix + key);
      if (!val) return null;
      return JSON.parse(val) as T;
    } catch (err) {
      this.logger.error(`Failed to get cache key: ${key}`, err);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await this.redis.setex(
        this.keyPrefix + key,
        ttlSeconds,
        JSON.stringify(value),
      );
    } catch (err) {
      this.logger.error(`Failed to set cache key: ${key}`, err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.keyPrefix + key);
    } catch (err) {
      this.logger.error(`Failed to delete cache key: ${key}`, err);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(this.keyPrefix + pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.error(`Failed to delete pattern: ${pattern}`, err);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Redis...');
    await this.redis.quit();
  }
}
