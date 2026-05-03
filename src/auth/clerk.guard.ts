import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { Request } from 'express';
import { UsersService } from '../modules/users/users.service';

interface AuthenticatedRequest extends Request {
  userId: string;
  user: unknown;
  cookies: Record<string, string | undefined>;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private readonly secretKey: string;
  private readonly jwtKey: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.secretKey = this.configService.getOrThrow<string>('CLERK_SECRET_KEY');
    // Optional: JWKS public key for local (offline) token verification
    const rawJwtKey = this.configService.get<string>('CLERK_JWT_KEY');
    // Replace literal \n with actual newlines (some dotenv versions don't expand them)
    this.jwtKey = rawJwtKey?.replace(/\\n/g, '\n');
    this.logger.log(
      this.jwtKey
        ? '🔑 Using CLERK_JWT_KEY for local token verification'
        : '🌐 Using CLERK_SECRET_KEY (API call mode)',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token =
      request.cookies?.['__session'] ||
      (request.headers['authorization']?.startsWith('Bearer ')
        ? request.headers['authorization'].split(' ')[1]
        : null);

    if (!token) {
      throw new UnauthorizedException(
        'Missing authentication token (Cookie or Header)',
      );
    }

    // Log first 20 chars of token to confirm it is arriving
    this.logger.debug(`Token received: ${token.substring(0, 20)}...`);

    try {
      // Prefer jwtKey (public RSA key) for local verification — no Clerk API call needed.
      // Fallback to secretKey which fetches JWKS from Clerk API.
      const payload = await verifyToken(
        token,
        this.jwtKey ? { jwtKey: this.jwtKey } : { secretKey: this.secretKey },
      );

      const clerkId = payload.sub;

      if (!clerkId) {
        throw new UnauthorizedException('Invalid token payload: missing sub');
      }

      request.userId = clerkId;
      request.user = await this.usersService.findOrSyncFromClerk(clerkId);

      return true;
    } catch (err) {
      // Log full error to understand the root cause
      this.logger.error(
        `Auth failed — name: ${(err as Error).name} | message: ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
