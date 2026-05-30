import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { UsersService } from '../modules/users/users.service';

@Injectable()
export class ClerkOptionalAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkOptionalAuthGuard.name);
  private readonly secretKey: string;
  private readonly jwtKey: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.secretKey = this.configService.getOrThrow<string>('CLERK_SECRET_KEY');
    const rawJwtKey = this.configService.get<string>('CLERK_JWT_KEY');
    this.jwtKey = rawJwtKey?.replace(/\\n/g, '\n');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token =
      request.cookies?.['__session'] ||
      (request.headers['authorization']?.startsWith('Bearer ')
        ? request.headers['authorization'].split(' ')[1]
        : null);

    if (!token) {
      return true;
    }

    try {
      let payload: any;
      try {
        payload = await verifyToken(
          token,
          this.jwtKey ? { jwtKey: this.jwtKey } : { secretKey: this.secretKey },
        );
      } catch (err) {
        // Fallback to online verification
        payload = await verifyToken(token, { secretKey: this.secretKey });
      }

      const clerkId = payload.sub;
      if (clerkId) {
        request.userId = clerkId;
        request.user = await this.usersService.findOrSyncFromClerk(clerkId);
      }
    } catch (err: any) {
      this.logger.debug(
        `Optional authentication token verification failed: ${err.message}`,
      );
    }

    return true;
  }
}
