import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFarmerAuthSchema1763380000000 implements MigrationInterface {
  name = 'CreateFarmerAuthSchema1763380000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE users_role_enum AS ENUM ('FARMER', 'EXPERT', 'REVIEWER', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE otp_purpose_enum AS ENUM ('REGISTER', 'LOGIN');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE users_orchard_type_enum AS ENUM ('TRADITIONAL', 'HIGH_DENSITY', 'BOTH');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phoneNumber" varchar(16) NOT NULL,
        role users_role_enum NOT NULL DEFAULT 'FARMER',
        "fullName" varchar(120),
        district varchar(120),
        municipality varchar(120),
        "wardNumber" smallint,
        "treeCount" integer,
        "orchardType" users_orchard_type_enum,
        "profilePhoto" varchar(2048),
        "isProfileComplete" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'mobileNumber'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'phoneNumber'
        ) THEN
          ALTER TABLE users RENAME COLUMN "mobileNumber" TO "phoneNumber";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "fullName" varchar(120),
        ADD COLUMN IF NOT EXISTS district varchar(120),
        ADD COLUMN IF NOT EXISTS municipality varchar(120),
        ADD COLUMN IF NOT EXISTS "wardNumber" smallint,
        ADD COLUMN IF NOT EXISTS "treeCount" integer,
        ADD COLUMN IF NOT EXISTS "orchardType" users_orchard_type_enum,
        ADD COLUMN IF NOT EXISTS "profilePhoto" varchar(2048),
        ADD COLUMN IF NOT EXISTS "isProfileComplete" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now(),
        DROP COLUMN IF EXISTS "hasPin",
        DROP COLUMN IF EXISTS "pinHash",
        DROP COLUMN IF EXISTS "pinFailedAttempts",
        DROP COLUMN IF EXISTS "pinLockedUntil";
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone_number
      ON users ("phoneNumber");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role_active
      ON users (role, "isActive");
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS otp_challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phoneNumber" varchar(32) NOT NULL,
        purpose otp_purpose_enum NOT NULL,
        "otpHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "attemptCount" integer NOT NULL DEFAULT 0,
        "usedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'otp_challenges' AND column_name = 'mobileNumber'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'otp_challenges' AND column_name = 'phoneNumber'
        ) THEN
          ALTER TABLE otp_challenges RENAME COLUMN "mobileNumber" TO "phoneNumber";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'otp_challenges' AND column_name = 'codeHash'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'otp_challenges' AND column_name = 'otpHash'
        ) THEN
          ALTER TABLE otp_challenges RENAME COLUMN "codeHash" TO "otpHash";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'otp_challenges' AND column_name = 'verifiedAt'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'otp_challenges' AND column_name = 'usedAt'
        ) THEN
          ALTER TABLE otp_challenges RENAME COLUMN "verifiedAt" TO "usedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE otp_challenges
        ADD COLUMN IF NOT EXISTS purpose otp_purpose_enum NOT NULL DEFAULT 'REGISTER',
        ADD COLUMN IF NOT EXISTS "otpHash" varchar(64),
        ADD COLUMN IF NOT EXISTS "usedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "attemptCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now();
      UPDATE otp_challenges SET "usedAt" = now()
      WHERE "usedAt" IS NULL AND "expiresAt" <= now();
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_purpose_created
      ON otp_challenges ("phoneNumber", purpose, "createdAt");
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "familyId" uuid NOT NULL,
        "tokenHash" varchar(255) NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz,
        "replacedByTokenId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id
      ON refresh_tokens ("familyId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
      ON refresh_tokens ("userId");
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'This migration may upgrade existing user data and cannot be safely reverted. Restore a database backup instead.',
    );
  }
}
