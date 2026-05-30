import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './core/database/database.module';
import { UsersModule } from './modules/users/users.module';
import { RazorpayModule } from './razorpay/razorpay.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { StrapiModule } from './core/strapi/strapi.module';
import { EbooksModule } from './modules/ebooks/ebooks.module';
import { CoursesModule } from './modules/courses/courses.module';
import { NotesModule } from './modules/notes/notes.module';
import { ScholarshipsModule } from './modules/scholarships/scholarships.module';
import { CacheModule } from './core/cache/cache.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { QueuesModule } from './queues/queues.module';

import {
  appConfig,
  strapiConfig,
  redisConfig,
} from './common/config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, strapiConfig, redisConfig],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000,
            limit: 10, // 10 requests per second
          },
          {
            name: 'medium',
            ttl: 60000,
            limit: 100, // 100 requests per minute
          },
        ],
      }),
    }),
    DatabaseModule,
    CacheModule,
    QueuesModule,
    UsersModule,
    RazorpayModule,
    WebhooksModule,
    StrapiModule,
    EbooksModule,
    CoursesModule,
    NotesModule,
    ScholarshipsModule,
    HomepageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
