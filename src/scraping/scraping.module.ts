import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { SCRAPING_QUEUE } from './scraping.constants';
import { ScraperService } from './scraper.service';
import { StrapiWriterService } from './strapi-writer.service';
import { ScrapingProducer } from './scraping.producer';
import { ScrapingConsumer } from './scraping.consumer';
import { ScrapingController } from './scraping.controller';
import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: SCRAPING_QUEUE }),
    // Provides UsersService for ClerkAuthGuard (used by the admin controller).
    UsersModule,
  ],
  controllers: [ScrapingController],
  providers: [
    ScraperService,
    StrapiWriterService,
    ScrapingProducer,
    ScrapingConsumer,
  ],
})
export class ScrapingModule {}
