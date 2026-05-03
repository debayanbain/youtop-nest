import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClerkClient, createClerkClient } from '@clerk/backend';
import { PostgresService } from 'src/core/database/postgres.service';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly clerk: ClerkClient;

  constructor(
    private readonly dbService: PostgresService,
    private readonly configService: ConfigService,
  ) {
    this.clerk = createClerkClient({
      secretKey: this.configService.getOrThrow<string>('CLERK_SECRET_KEY'),
    });
  }

  // ─── Called by the frontend POST /users/sync after sign-in ─────────────────
  async syncUser(dto: UserDto) {
    this.logger.debug(`Syncing user: ${JSON.stringify(dto)}`);
    const { clerkId, firstName, lastName, emailId, imageUrl } = dto;

    try {
      const [user] = await this.dbService.models.User.upsert({
        clerkId,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        emailId: emailId?.trim() || null,
        imageUrl: imageUrl ?? null,
        status: 'active',
        role: 'user',
      });
      this.logger.debug(`Synced user: ${clerkId}`);
      return user;
    } catch (err) {
      this.logger.error('Failed to sync user', err);
      throw err;
    }
  }

  // ─── Called by webhook: user.created (idempotent) ──────────────────────────
  async findOrCreateFromClerk(data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  }) {
    const primaryEmail = data.email_addresses?.[0]?.email_address ?? '';

    const [user] = await this.dbService.models.User.findOrCreate({
      where: { clerkId: data.id },
      defaults: {
        clerkId: data.id,
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        emailId: primaryEmail,
        imageUrl: data.image_url ?? null,
        role: 'user',
        status: 'active',
      },
    });

    this.logger.log(`[Webhook] Created/found user: ${data.id}`);
    return user;
  }

  // ─── Called by webhook: user.updated ───────────────────────────────────────
  async updateFromClerk(data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  }) {
    const primaryEmail = data.email_addresses?.[0]?.email_address ?? '';

    await this.dbService.models.User.update(
      {
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        emailId: primaryEmail,
        imageUrl: data.image_url ?? null,
        status: 'active',
      },
      { where: { clerkId: data.id } },
    );

    this.logger.log(`[Webhook] Updated user: ${data.id}`);
  }

  // ─── Called by webhook: user.deleted (soft delete) ─────────────────────────
  async softDeleteFromClerk(clerkId: string) {
    await this.dbService.models.User.update(
      { status: 'suspended' },
      { where: { clerkId } },
    );
    this.logger.log(`[Webhook] Soft-deleted user: ${clerkId}`);
  }

  // ─── Called by auth guard on every request ─────────────────────────────────
  // Fast path: find in DB. Slow path: fetch from Clerk API if missing (webhook missed).
  async findOrSyncFromClerk(clerkId: string) {
    const existing = await this.dbService.models.User.findOne({
      where: { clerkId },
    });

    if (existing) return existing;

    // Webhook may have been missed — fetch directly from Clerk API
    this.logger.warn(
      `clerkId ${clerkId} not in DB — fetching from Clerk API (webhook likely missed)`,
    );

    try {
      const clerkUser = await this.clerk.users.getUser(clerkId);
      const primaryEmail =
        clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkId}@unknown.local`;

      const [user] = await this.dbService.models.User.findOrCreate({
        where: { clerkId },
        defaults: {
          clerkId: clerkUser.id,
          firstName: clerkUser.firstName ?? null,
          lastName: clerkUser.lastName ?? null,
          emailId: primaryEmail,
          imageUrl: clerkUser.imageUrl ?? null,
          role: 'user',
          status: 'active',
        },
      });

      return user;
    } catch (err) {
      this.logger.error(
        `Failed to fetch clerkId ${clerkId} from Clerk API`,
        err,
      );
      throw new NotFoundException('User not found');
    }
  }

  // ─── Find by clerkId ───────────────────────────────────────────────────────
  async findByClerkId(clerkId: string) {
    const user = await this.dbService.models.User.findOne({
      where: { clerkId },
    });
    if (!user)
      throw new NotFoundException(`No user found for clerkId: ${clerkId}`);
    return user;
  }
}
