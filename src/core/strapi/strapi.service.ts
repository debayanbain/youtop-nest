import { Injectable, Logger } from '@nestjs/common';
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
export class StrapiService {
  private readonly logger = new Logger(StrapiService.name);
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.baseUrl = (
      this.configService.get<string>('STRAPI_URL') || 'http://localhost:1337'
    ).replace(/\/$/, '');
    this.apiToken = this.configService.get<string>('STRAPI_API_TOKEN') || '';
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
    const cached = await this.cacheService.get<T[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for collection: ${path}`);
      return cached;
    }

    this.logger.debug(
      `Cache miss for collection: ${path}. Fetching from Strapi...`,
    );
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

    await this.cacheService.set(cacheKey, result, ttlSeconds);
    return result;
  }

  /**
   * Fetch a single type (homepage, global-settings). Cached by key.
   */
  async getSingle<T>(path: string, ttlSeconds = 60): Promise<T | null> {
    const cacheKey = `strapi:single:${path}`;
    const cached = await this.cacheService.get<T>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for single: ${path}`);
      return cached;
    }

    this.logger.debug(
      `Cache miss for single: ${path}. Fetching from Strapi...`,
    );
    const json = await this.fetchRaw<StrapiSingleResponse<any>>(path);

    let result: T | null = null;
    if (json && json.data) {
      result = this.flatten<T>(json.data);
    } else if (json) {
      result = this.flatten<T>(json);
    }

    if (result) {
      await this.cacheService.set(cacheKey, result, ttlSeconds);
    }
    return result;
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
   * Raw request handler
   */
  private async fetchRaw<T>(path: string): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}/api${cleanPath}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(60000), // 10s request timeout
      });

      if (!response.ok) {
        throw new Error(
          `Strapi error: ${response.statusText} (${response.status})`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(`Failed to fetch from Strapi: ${url}`, error);
      throw error;
    }
  }
}
