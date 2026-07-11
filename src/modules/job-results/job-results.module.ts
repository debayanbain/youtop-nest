import { Module } from '@nestjs/common';
import { JobResultsController } from './job-results.controller';
import { JobResultsService } from './job-results.service';
import { StrapiModule } from '../../core/strapi/strapi.module';

@Module({
  imports: [StrapiModule],
  controllers: [JobResultsController],
  providers: [JobResultsService],
})
export class JobResultsModule {}
