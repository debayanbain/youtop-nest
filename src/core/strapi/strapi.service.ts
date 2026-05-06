import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StrapiService {
  private readonly logger = new Logger(StrapiService.name);
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('STRAPI_URL') || 'http://localhost:1337';
    this.apiToken = this.configService.get<string>('STRAPI_API_TOKEN') || '';
  }

  /**
   * Fetch data from Strapi and flatten the response
   */
  async get<T>(path: string): Promise<T[]> {
    const url = `${this.baseUrl}/api${path}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Strapi error: ${response.statusText}`);
      }

      const json = await response.json();

      // Flatten Strapi v5 response
      // Strapi returns { data: [{ id, ...attributes }, ...] }
      if (json.data && Array.isArray(json.data)) {
        return json.data.map((item) => ({
          id: item.id,
          ...item, // Strapi 5 flattens attributes by default in some cases, or keeps them in attributes
          ...(item.attributes || {}),
        }));
      }

      return json.data || json;
    } catch (error) {
      this.logger.error(`Failed to fetch from Strapi: ${url}`, error);
      return [];
    }
  }
}
