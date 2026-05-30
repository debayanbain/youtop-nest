import { Module } from '@nestjs/common';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';
import { StrapiModule } from '../../core/strapi/strapi.module';

@Module({
  imports: [StrapiModule],
  controllers: [HomepageController],
  providers: [HomepageService],
})
export class HomepageModule {}
