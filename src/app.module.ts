import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    RazorpayModule,
    WebhooksModule,
    StrapiModule,
    EbooksModule,
    CoursesModule,
    NotesModule,
    ScholarshipsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
