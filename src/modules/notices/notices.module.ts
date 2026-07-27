import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

/**
 * Public notice board module. PostgresService is @Global (DatabaseModule), so
 * no import is needed to inject it.
 */
@Module({
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
