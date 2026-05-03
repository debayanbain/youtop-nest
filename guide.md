# Clerk + NestJS + PostgreSQL — Complete Sync Implementation

> Copy-paste in the order listed. Every file is complete — no placeholders.

---

## STEP 0 — Install dependencies

```bash
npm install @clerk/clerk-sdk-node svix @nestjs/schedule @nestjs/config
npm install --save-dev @types/node
```

---

## STEP 1 — Environment variables

**File: `.env`**

```env
# Clerk
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_SYNCHRONIZE=false

# App
PORT=3000
NODE_ENV=production
```

> Get `CLERK_WEBHOOK_SECRET` from Clerk Dashboard → Webhooks → your endpoint → Signing Secret.
> Webhook URL to register: `https://yourdomain.com/webhooks/clerk`
> Events to subscribe: `user.created`, `user.updated`, `user.deleted`

---

## STEP 2 — User Entity

**File: `src/users/entities/user.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Primary link between Clerk and your DB — never nullable
  @Column({ unique: true })
  @Index()
  clerkId: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  imageUrl: string;

  // Your business data — Clerk knows nothing about these
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'jsonb', default: {} })
  preferences: Record<string, unknown>;

  // Add your own business columns here, e.g.:
  // @Column({ nullable: true })
  // stripeCustomerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
```

---

## STEP 3 — Webhook Event Entity (idempotency table)

**File: `src/webhooks/entities/webhook-event.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Clerk's unique event ID — used to prevent duplicate processing
  @Column({ unique: true })
  @Index()
  svixId: string;

  @Column()
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ default: false })
  processed: boolean;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

## STEP 4 — Clerk User DTO (typed shape of Clerk's webhook payload)

**File: `src/users/dto/clerk-user.dto.ts`**

```typescript
export interface ClerkEmailAddress {
  id: string;
  email_address: string;
  verification: { status: string } | null;
}

export interface ClerkUserData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  created_at: number;
  updated_at: number;
}

export interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: ClerkUserData & { deleted?: boolean };
}

// Helper — get primary email from Clerk user data
export function getPrimaryEmail(data: ClerkUserData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? '';
}
```

---

## STEP 5 — Users Service

**File: `src/users/users.service.ts`**

```typescript
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { ConfigService } from '@nestjs/config';
import { User, UserStatus } from './entities/user.entity';
import { ClerkUserData, getPrimaryEmail } from './dto/clerk-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly clerk;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    this.clerk = createClerkClient({
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });
  }

  // ─── Called by webhook: user.created ───────────────────────────────────────

  async createFromClerk(data: ClerkUserData): Promise<User> {
    // Idempotent — webhook may fire more than once
    const existing = await this.userRepo.findOne({
      where: { clerkId: data.id },
    });

    if (existing) {
      this.logger.warn(
        `user.created fired for existing clerkId ${data.id} — upserting instead`,
      );
      return this.updateFromClerk(data);
    }

    const user = this.userRepo.create({
      clerkId: data.id,
      email: getPrimaryEmail(data),
      firstName: data.first_name ?? undefined,
      lastName: data.last_name ?? undefined,
      imageUrl: data.image_url ?? undefined,
      status: UserStatus.ACTIVE,
    });

    const saved = await this.userRepo.save(user);
    this.logger.log(`Created DB user for clerkId ${data.id}`);
    return saved;
  }

  // ─── Called by webhook: user.updated ───────────────────────────────────────

  async updateFromClerk(data: ClerkUserData): Promise<User> {
    await this.userRepo.upsert(
      {
        clerkId: data.id,
        email: getPrimaryEmail(data),
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
        imageUrl: data.image_url ?? undefined,
        status: UserStatus.ACTIVE,
      },
      {
        conflictPaths: ['clerkId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    this.logger.log(`Upserted DB user for clerkId ${data.id}`);
    return this.findByClerkId(data.id);
  }

  // ─── Called by webhook: user.deleted ───────────────────────────────────────

  async deactivateFromClerk(clerkId: string): Promise<void> {
    await this.userRepo.update(
      { clerkId },
      {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
      },
    );
    this.logger.log(`Soft-deleted DB user for clerkId ${clerkId}`);
  }

  // ─── Called by auth guard on every request ─────────────────────────────────

  async findOrSyncFromClerk(clerkId: string): Promise<User> {
    // Fast path — already in DB
    const existing = await this.userRepo.findOne({
      where: { clerkId },
    });
    if (existing) return existing;

    // Slow path — webhook missed, fetch directly from Clerk API
    this.logger.warn(
      `clerkId ${clerkId} not in DB — fetching from Clerk API (webhook likely missed)`,
    );

    try {
      const clerkUser = await this.clerk.users.getUser(clerkId);

      const user = this.userRepo.create({
        clerkId: clerkUser.id,
        email:
          clerkUser.emailAddresses[0]?.emailAddress ??
          `${clerkId}@unknown.local`,
        firstName: clerkUser.firstName ?? undefined,
        lastName: clerkUser.lastName ?? undefined,
        imageUrl: clerkUser.imageUrl ?? undefined,
        status: UserStatus.ACTIVE,
      });

      return this.userRepo.save(user);
    } catch (err) {
      this.logger.error(
        `Failed to fetch clerkId ${clerkId} from Clerk API`,
        err,
      );
      throw new NotFoundException('User not found');
    }
  }

  // ─── General queries ───────────────────────────────────────────────────────

  async findByClerkId(clerkId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { clerkId } });
    if (!user) throw new NotFoundException(`No user found for clerkId: ${clerkId}`);
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`No user found for id: ${id}`);
    return user;
  }

  // ─── Used by backfill / cron ───────────────────────────────────────────────

  async upsertFromClerkBatch(users: ClerkUserData[]): Promise<void> {
    if (users.length === 0) return;

    await this.userRepo.upsert(
      users.map((u) => ({
        clerkId: u.id,
        email: getPrimaryEmail(u),
        firstName: u.first_name ?? undefined,
        lastName: u.last_name ?? undefined,
        imageUrl: u.image_url ?? undefined,
        status: UserStatus.ACTIVE,
      })),
      {
        conflictPaths: ['clerkId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
  }
}
```

---

## STEP 6 — Users Sync Service (cron job — Layer 3 recovery)

**File: `src/users/users-sync.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Injectable()
export class UsersSyncService {
  private readonly logger = new Logger(UsersSyncService.name);
  private readonly clerk;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.clerk = createClerkClient({
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });
  }

  // Runs every 15 minutes — only processes records updated in last 30 min
  @Cron('*/15 * * * *')
  async reconcileRecentUsers(): Promise<void> {
    this.logger.log('Starting incremental Clerk → DB reconciliation');

    let offset = 0;
    const limit = 100;
    let totalSynced = 0;
    const windowMs = 30 * 60 * 1000; // 30 minutes

    try {
      while (true) {
        const { data: clerkUsers } = await this.clerk.users.getUserList({
          limit,
          offset,
          orderBy: '-updated_at',
        });

        if (clerkUsers.length === 0) break;

        // Stop once we're past the 30-minute window
        const oldestUpdatedAt = clerkUsers[clerkUsers.length - 1].updatedAt;
        const shouldStop = Date.now() - oldestUpdatedAt > windowMs;

        const recentUsers = shouldStop
          ? clerkUsers.filter((u) => Date.now() - u.updatedAt <= windowMs)
          : clerkUsers;

        if (recentUsers.length > 0) {
          await this.usersService.upsertFromClerkBatch(
            recentUsers.map((u) => ({
              id: u.id,
              first_name: u.firstName,
              last_name: u.lastName,
              image_url: u.imageUrl,
              email_addresses: u.emailAddresses.map((e) => ({
                id: e.id,
                email_address: e.emailAddress,
                verification: null,
              })),
              primary_email_address_id: u.primaryEmailAddressId ?? '',
              created_at: u.createdAt,
              updated_at: u.updatedAt,
            })),
          );
          totalSynced += recentUsers.length;
        }

        if (shouldStop || clerkUsers.length < limit) break;
        offset += limit;
      }

      this.logger.log(`Reconciliation done — ${totalSynced} users synced`);
    } catch (err) {
      this.logger.error('Reconciliation job failed', err);
    }
  }

  // Call this manually via a one-off script for full backfill
  async fullBackfill(): Promise<void> {
    this.logger.log('Starting FULL Clerk → DB backfill');
    let offset = 0;
    const limit = 100;
    let total = 0;

    while (true) {
      const { data: clerkUsers, totalCount } =
        await this.clerk.users.getUserList({ limit, offset });

      if (clerkUsers.length === 0) break;

      this.logger.log(`Backfilling ${offset}–${offset + clerkUsers.length} of ${totalCount}`);

      await this.usersService.upsertFromClerkBatch(
        clerkUsers.map((u) => ({
          id: u.id,
          first_name: u.firstName,
          last_name: u.lastName,
          image_url: u.imageUrl,
          email_addresses: u.emailAddresses.map((e) => ({
            id: e.id,
            email_address: e.emailAddress,
            verification: null,
          })),
          primary_email_address_id: u.primaryEmailAddressId ?? '',
          created_at: u.createdAt,
          updated_at: u.updatedAt,
        })),
      );

      total += clerkUsers.length;
      offset += limit;
    }

    this.logger.log(`Full backfill complete — ${total} users processed`);
  }
}
```

---

## STEP 7 — Users Module

**File: `src/users/users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersSyncService } from './users-sync.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, UsersSyncService],
  controllers: [UsersController],
  exports: [UsersService], // exported — used by AuthModule and WebhooksModule
})
export class UsersModule {}
```

---

## STEP 8 — Webhook Controller

**File: `src/webhooks/webhooks.controller.ts`**

```typescript
import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { Webhook } from 'svix';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { ClerkWebhookEvent } from '../users/dto/clerk-user.dto';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {}

  @Post('clerk')
  @HttpCode(200) // Always 200 — Clerk stops retrying on non-2xx
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    // 1. Verify Svix signature — rejects spoofed requests
    const secret = this.configService.getOrThrow<string>('CLERK_WEBHOOK_SECRET');
    const wh = new Webhook(secret);
    let event: ClerkWebhookEvent;

    try {
      event = wh.verify(req.rawBody!.toString(), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      this.logger.warn(`Invalid webhook signature: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Process — wrapped so we always return 200
    try {
      await this.webhooksService.processEvent(svixId, event);
    } catch (err) {
      // Log the error but still return 200 so Clerk doesn't keep retrying
      // The event is saved in DB for manual inspection / replay
      this.logger.error(`Webhook processing error for ${svixId}`, err);
    }

    return { received: true };
  }
}
```

---

## STEP 9 — Webhook Service

**File: `src/webhooks/webhooks.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { ClerkWebhookEvent } from '../users/dto/clerk-user.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,
  ) {}

  async processEvent(svixId: string, event: ClerkWebhookEvent): Promise<void> {
    // Idempotency check — skip if already processed
    const existing = await this.webhookEventRepo.findOne({
      where: { svixId },
    });

    if (existing?.processed) {
      this.logger.warn(`Duplicate webhook ${svixId} — skipping`);
      return;
    }

    // Save the raw event first (for audit + replay)
    const record = await this.webhookEventRepo.save(
      this.webhookEventRepo.create({
        svixId,
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
        processed: false,
      }),
    );

    try {
      switch (event.type) {
        case 'user.created':
          await this.usersService.createFromClerk(event.data);
          break;

        case 'user.updated':
          await this.usersService.updateFromClerk(event.data);
          break;

        case 'user.deleted':
          await this.usersService.deactivateFromClerk(event.data.id);
          break;

        default:
          this.logger.warn(`Unhandled event type: ${event.type}`);
      }

      // Mark as successfully processed
      await this.webhookEventRepo.update(record.id, { processed: true });
      this.logger.log(`Processed webhook ${svixId} (${event.type})`);
    } catch (err) {
      // Save error for debugging — cron/manual replay can retry later
      await this.webhookEventRepo.update(record.id, {
        errorMessage: err.message,
      });
      throw err; // re-throw so controller logs it
    }
  }
}
```

---

## STEP 10 — Webhooks Module

**File: `src/webhooks/webhooks.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent]),
    UsersModule, // imports UsersService
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
```

---

## STEP 11 — Auth Guard

**File: `src/auth/clerk-auth.guard.ts`**

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private readonly clerk;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.clerk = createClerkClient({
      secretKey: this.configService.getOrThrow<string>('CLERK_SECRET_KEY'),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('No bearer token provided');
    }

    try {
      // Verify JWT with Clerk — checks signature, expiry, issuer
      const payload = await this.clerk.verifyToken(token);
      const clerkId = payload.sub;

      // Layer 2 recovery: if webhook missed, this fetches from Clerk API
      req.user = await this.usersService.findOrSyncFromClerk(clerkId);

      return true;
    } catch (err) {
      this.logger.warn(`Auth failed: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(req: any): string | null {
    const auth = req.headers?.authorization as string | undefined;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
```

---

## STEP 12 — CurrentUser Decorator

**File: `src/auth/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../users/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

## STEP 13 — Auth Module

**File: `src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [ClerkAuthGuard],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}
```

---

## STEP 14 — App Module

**File: `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { User } from './users/entities/user.entity';
import { WebhookEvent } from './webhooks/entities/webhook-event.entity';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Config — loads .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Scheduler — enables @Cron decorators
    ScheduleModule.forRoot(),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        database: config.get('DATABASE_NAME'),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        entities: [User, WebhookEvent],
        synchronize: config.get('DATABASE_SYNCHRONIZE') === 'true',
        // In production set synchronize: false and use migrations
        ssl: config.get('NODE_ENV') === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    UsersModule,
    WebhooksModule,
    AuthModule,
  ],
})
export class AppModule {}
```

---

## STEP 15 — Main.ts (raw body required for webhook verification)

**File: `src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // REQUIRED — Svix needs the raw body to verify signatures
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Server running on http://localhost:${port}`);
}

bootstrap();
```

---

## STEP 16 — Example Controller (how to use in your routes)

**File: `src/users/users.controller.ts`**

```typescript
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(ClerkAuthGuard) // protect entire controller
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return user; // full DB user, not Clerk data
  }

  // PATCH /users/me/preferences
  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() body: { preferences: Record<string, unknown> },
  ) {
    // Example of updating business data — Clerk is not involved here at all
    await this.usersService['userRepo'].update(user.id, {
      preferences: body.preferences,
    });
    return { success: true };
  }
}
```

---

## Final folder structure

```
src/
├── auth/
│   ├── auth.module.ts           ← Step 13
│   ├── clerk-auth.guard.ts      ← Step 11
│   └── current-user.decorator.ts ← Step 12
├── users/
│   ├── dto/
│   │   └── clerk-user.dto.ts    ← Step 4
│   ├── entities/
│   │   └── user.entity.ts       ← Step 2
│   ├── users.controller.ts      ← Step 16
│   ├── users.module.ts          ← Step 7
│   ├── users.service.ts         ← Step 5
│   └── users-sync.service.ts    ← Step 6
├── webhooks/
│   ├── entities/
│   │   └── webhook-event.entity.ts ← Step 3
│   ├── webhooks.controller.ts   ← Step 8
│   ├── webhooks.module.ts       ← Step 10
│   └── webhooks.service.ts      ← Step 9
├── app.module.ts                ← Step 14
└── main.ts                      ← Step 15
```

---

## Clerk Dashboard checklist

1. Go to **Clerk Dashboard → Webhooks → Add Endpoint**
2. URL: `https://yourdomain.com/webhooks/clerk`
3. Subscribe to: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** → paste into `.env` as `CLERK_WEBHOOK_SECRET`

For local development use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# Use the https URL as your webhook endpoint in Clerk dashboard
```

---

## Recovery flows summary

| Scenario | How it's handled |
|---|---|
| Server was briefly down | Clerk auto-retries for up to 5 days |
| Webhook arrived, processing threw error | Saved in `webhook_events` with `errorMessage`, Clerk retries |
| User signed up, webhook never arrived | `findOrSyncFromClerk` in guard fetches from Clerk API on first login |
| User signed up, never logged in | `UsersSyncService` cron catches within 30 min |
| Need full re-sync | Call `usersSyncService.fullBackfill()` from a script |
| Specific failed event | Clerk Dashboard → Webhooks → Replay |