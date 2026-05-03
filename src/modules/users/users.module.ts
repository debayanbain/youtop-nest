import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ClerkAuthGuard } from '../../auth/clerk.guard';

@Module({
  imports: [ConfigModule],
  controllers: [UsersController],
  providers: [UsersService, ClerkAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
