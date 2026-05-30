import { Module } from '@nestjs/common';
import { StrapiService } from './strapi.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [StrapiService],
  exports: [StrapiService],
})
export class StrapiModule {}
