import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ClerkAuthGuard } from '../../auth/clerk.guard';
import { UserId } from '../../auth/user-id.decorator';

class SyncUserBody {
  @IsString()
  @IsOptional()
  firstName?: string | null;

  @IsString()
  @IsOptional()
  lastName?: string | null;

  @IsEmail()
  @IsNotEmpty()
  emailId: string;

  @IsString()
  @IsOptional()
  imageUrl?: string | null;
}

@Controller('users')
@UseGuards(ClerkAuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users/sync
   * Called by the Next.js frontend after sign-in.
   * Upserts the user in the DB from the data sent by the frontend.
   */
  @Post('sync')
  async syncUser(@UserId() userId: string, @Body() body: SyncUserBody) {
    this.logger.debug(
      `Received sync request for ${userId} with body: ${JSON.stringify(body)}`,
    );
    const result = await this.usersService.syncUser({
      clerkId: userId,
      firstName: body.firstName,
      lastName: body.lastName,
      emailId: body.emailId,
      imageUrl: body.imageUrl,
    });

    this.logger.debug(`Synced user ${userId}`);
    return result;
  }

  /**
   * GET /users/me
   * Returns the full DB record for the signed-in user.
   * The guard has already fetched req.user, so we just return it.
   */
  @Get('me')
  getMe(@Req() req: Request & { user: Record<string, unknown> }) {
    return req.user;
  }
}
