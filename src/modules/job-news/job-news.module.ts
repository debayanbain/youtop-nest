import { Module } from '@nestjs/common';
import { JobNewsController } from './job-news.controller';
import { JobNewsService } from './job-news.service';
import { StrapiModule } from '../../core/strapi/strapi.module';

@Module({
  imports: [StrapiModule],
  controllers: [JobNewsController],
  providers: [JobNewsService],
})
export class JobNewsModule {}
