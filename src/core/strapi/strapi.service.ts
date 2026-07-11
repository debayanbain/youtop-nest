import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';

export interface StrapiListResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiSingleResponse<T> {
  data: T;
}

@Injectable()
export class StrapiService implements OnModuleInit {
  private readonly logger = new Logger(StrapiService.name);
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly isDev: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.baseUrl = (
      this.configService.get<string>('STRAPI_URL') || 'http://localhost:1337'
    ).replace(/\/$/, '');
    this.apiToken = this.configService.get<string>('STRAPI_API_TOKEN') || '';

    const env = this.configService.get<string>('NODE_ENV', 'development');
    this.isDev = env !== 'production';
    if (this.isDev) {
      this.logger.log(
        'Running in development mode. Strapi caching is bypassed.',
      );
    }
  }

  /**
   * Helper to flatten Strapi v5 objects
   */
  private flatten<T>(item: any): T {
    if (!item) return item;
    const { attributes, ...rest } = item;
    const flattened = {
      id: item.id,
      ...rest,
      ...(attributes || {}),
    };

    // Recursively flatten children if they are objects or arrays
    for (const key of Object.keys(flattened)) {
      if (Array.isArray(flattened[key])) {
        flattened[key] = flattened[key].map((subItem: any) =>
          typeof subItem === 'object' ? this.flatten(subItem) : subItem,
        );
      } else if (
        flattened[key] &&
        typeof flattened[key] === 'object' &&
        !flattened[key].__component // Don't flatten dynamic zone components
      ) {
        if ('data' in flattened[key]) {
          const relationData = flattened[key].data;
          if (Array.isArray(relationData)) {
            flattened[key] = relationData.map((subItem: any) =>
              this.flatten(subItem),
            );
          } else if (relationData) {
            flattened[key] = this.flatten(relationData);
          } else {
            flattened[key] = null;
          }
        } else {
          flattened[key] = this.flatten(flattened[key]);
        }
      }
    }

    return flattened as T;
  }

  /**
   * Fetch data from Strapi and flatten the response (Backward Compatibility Method)
   */
  async get<T>(path: string): Promise<T[]> {
    return this.getCollection<T>(path);
  }

  /**
   * Fetch a collection (returns array). Cached by key.
   */
  async getCollection<T>(path: string, ttlSeconds = 60): Promise<T[]> {
    const cacheKey = `strapi:collection:${path}`;

    if (!this.isDev) {
      const cached = await this.cacheService.get<T[]>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for collection: ${path}`);
        return cached;
      }
      this.logger.debug(
        `Cache miss for collection: ${path}. Fetching from Strapi...`,
      );
    } else {
      this.logger.debug(`Bypassing cache (Dev mode): ${path}. Fetching...`);
    }

    const json = await this.fetchRaw<StrapiListResponse<any>>(path);

    let result: T[] = [];
    if (json && json.data) {
      if (Array.isArray(json.data)) {
        result = json.data.map((item) => this.flatten<T>(item));
      } else if (typeof json.data === 'object') {
        // Fallback for unexpected formats
        result = [this.flatten<T>(json.data)];
      }
    } else if (Array.isArray(json)) {
      result = json.map((item) => this.flatten<T>(item));
    }

    if (!this.isDev) {
      await this.cacheService.set(cacheKey, result, ttlSeconds);
    }
    return result;
  }

  /**
   * Fetch a single type (homepage, global-settings). Cached by key.
   */
  async getSingle<T>(path: string, ttlSeconds = 60): Promise<T | null> {
    const cacheKey = `strapi:single:${path}`;

    if (!this.isDev) {
      const cached = await this.cacheService.get<T>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for single: ${path}`);
        return cached;
      }
      this.logger.debug(
        `Cache miss for single: ${path}. Fetching from Strapi...`,
      );
    } else {
      this.logger.debug(`Bypassing cache (Dev mode): ${path}. Fetching...`);
    }

    const json = await this.fetchRaw<StrapiSingleResponse<any>>(path);

    let result: T | null = null;
    if (json && json.data) {
      result = this.flatten<T>(json.data);
    } else if (json) {
      result = this.flatten<T>(json);
    }

    if (result && !this.isDev) {
      await this.cacheService.set(cacheKey, result, ttlSeconds);
    }
    return result;
  }

  /**
   * Fire a cheap ping to wake Render.com's free-tier instance on app boot
   * so the first real request doesn't hit a cold start.
   */
  async onModuleInit(): Promise<void> {
    this.warmUp().catch(() => {
      // Non-fatal — warmup failure must never break app startup
    });
  }

  async warmUp(): Promise<void> {
    const url = `${this.baseUrl}/_health`;
    this.logger.log(
      'Warming up Strapi instance (Render cold-start prevention)…',
    );
    try {
      await fetch(url, {
        signal: AbortSignal.timeout(120_000), // 2 min: enough for any cold start
      });
      this.logger.log('Strapi warm-up complete.');
    } catch {
      // Render returns a non-2xx or times out — either way the instance is awake
      this.logger.warn(
        'Strapi warm-up ping finished (non-OK response is fine).',
      );
    }
  }

  /**
   * Invalidate Strapi cache keys
   */
  async invalidate(path: string): Promise<void> {
    await this.cacheService.del(`strapi:collection:${path}`);
    await this.cacheService.del(`strapi:single:${path}`);
    this.logger.log(`Invalidated cache for Strapi path: ${path}`);
  }

  /**
   * Raw request handler with retry-on-timeout.
   * Render.com free tier cold starts take 60–120 s; a single timeout kills the
   * request before the instance is ready.  Retrying 2 more times (with a small
   * back-off) gives the server the time it needs to wake up.
   */
  private async fetchRaw<T>(
    path: string,
    attempt = 1,
    maxAttempts = 3,
  ): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}/api${cleanPath}`;
    // Per-attempt timeout: 45 s is plenty once warm; 3 × 45 s = 135 s total budget.
    const timeoutMs = 45_000;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Strapi error: ${response.statusText} (${response.status}) — ${body}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');

      if (isTimeout && attempt < maxAttempts) {
        const backoffMs = attempt * 5_000; // 5 s, 10 s …
        this.logger.warn(
          `Strapi timeout (attempt ${attempt}/${maxAttempts}). Render may be cold-starting. Retrying in ${backoffMs / 1000}s…`,
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.fetchRaw<T>(path, attempt + 1, maxAttempts);
      }

      this.logger.error(`Failed to fetch from Strapi: ${url}`);
      this.logger.error(error);
      throw error;
    }
  }
}
