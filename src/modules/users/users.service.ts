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
    const secretKey = this.configService.getOrThrow<string>('CLERK_SECRET_KEY');
    this.logger.debug(
      `Initializing Clerk client with key: ${secretKey.substring(0, 10)}...${secretKey.slice(-5)}`,
    );
    this.clerk = createClerkClient({ secretKey });
  }

  // ─── Called by the frontend POST /users/sync after sign-in ─────────────────
  async syncUser(dto: UserDto) {
    this.logger.debug(`Syncing user: ${JSON.stringify(dto)}`);
    const { clerkId, firstName, lastName, emailId, imageUrl } = dto;

    try {
      await this.dbService.getConnection();
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
    const primaryEmail = data.email_addresses?.[0]?.email_address || null;

    await this.dbService.getConnection();
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
    const primaryEmail = data.email_addresses?.[0]?.email_address || null;

    await this.dbService.getConnection();
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
    await this.dbService.getConnection();
    await this.dbService.models.User.update(
      { status: 'suspended' },
      { where: { clerkId } },
    );
    this.logger.log(`[Webhook] Soft-deleted user: ${clerkId}`);
  }

  // ─── Called by auth guard on every request ─────────────────────────────────
  // Fast path: find in DB. Slow path: fetch from Clerk API if missing (webhook missed).
  async findOrSyncFromClerk(clerkId: string) {
    await this.dbService.getConnection();
    const existing = await this.dbService.models.User.findOne({
      where: { clerkId },
    });

    if (existing) return existing;

    // Webhook may have been missed — fetch directly from Clerk API
    this.logger.warn(
      `clerkId ${clerkId} not in DB — fetching from Clerk API (sync-on-demand)`,
    );

    let clerkUser: Awaited<ReturnType<typeof this.clerk.users.getUser>>;
    try {
      clerkUser = await this.clerk.users.getUser(clerkId);
    } catch (apiErr) {
      this.logger.error(
        `Failed to fetch clerkId ${clerkId} from Clerk API`,
        apiErr,
      );
      throw new Error(`Clerk API error: ${(apiErr as Error).message}`);
    }

    if (!clerkUser) {
      throw new NotFoundException(`User ${clerkId} not found in Clerk API`);
    }

    const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress ?? null;

    this.logger.debug(
      `Fetched user from Clerk: ${clerkUser.id} | Email: ${primaryEmail}`,
    );

    await this.dbService.getConnection();

    try {
      // Try creating by clerkId (happy path for brand new users)
      const [user, created] = await this.dbService.models.User.findOrCreate({
        where: { clerkId },
        defaults: {
          clerkId: clerkUser.id,
          firstName: clerkUser.firstName || null,
          lastName: clerkUser.lastName || null,
          emailId: primaryEmail,
          imageUrl: clerkUser.imageUrl ?? null,
          role: 'user',
          status: 'active',
        },
      });

      if (created) {
        this.logger.log(
          `[Auth] Created new user in DB from Clerk API: ${clerkId}`,
        );
      } else {
        this.logger.log(
          `[Auth] User ${clerkId} already existed in DB (race condition handled)`,
        );
      }

      return user;
    } catch (dbErr: any) {
      // Handle case: same email already exists with a different clerkId (e.g. Google re-auth)
      if (dbErr?.name === 'SequelizeUniqueConstraintError' && primaryEmail) {
        this.logger.warn(
          `[Auth] Email ${primaryEmail} already exists — migrating clerkId to ${clerkId}`,
        );

        // Find the existing record by email and update its clerkId to the new one
        const existing = await this.dbService.models.User.findOne({
          where: { emailId: primaryEmail },
        });

        if (existing) {
          await existing.update({
            clerkId,
            firstName: clerkUser.firstName || existing.firstName,
            lastName: clerkUser.lastName || existing.lastName,
            imageUrl: clerkUser.imageUrl ?? existing.imageUrl,
            status: 'active',
          });
          this.logger.log(
            `[Auth] Migrated existing user (id=${existing.id}) to new clerkId: ${clerkId}`,
          );
          return existing;
        }
      }

      this.logger.error(
        `Failed to create/find user for clerkId ${clerkId} in DB`,
        dbErr,
      );
      throw new Error(`User sync failed: ${(dbErr as Error).message}`);
    }
  }

  // ─── Find by clerkId ───────────────────────────────────────────────────────
  async findByClerkId(clerkId: string) {
    await this.dbService.getConnection();
    const user = await this.dbService.models.User.findOne({
      where: { clerkId },
    });
    if (!user)
      throw new NotFoundException(`No user found for clerkId: ${clerkId}`);
    return user;
  }
}
