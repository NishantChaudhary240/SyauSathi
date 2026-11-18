import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFarmerOrchardProfileFields1794912489000 implements MigrationInterface {
  name = 'AddFarmerOrchardProfileFields1794912489000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE users_orchard_type_enum AS ENUM (
          'TRADITIONAL',
          'HIGH_DENSITY',
          'BOTH'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "treeCount" integer,
        ADD COLUMN IF NOT EXISTS "orchardType" users_orchard_type_enum,
        DROP COLUMN IF EXISTS "hasPin",
        DROP COLUMN IF EXISTS "pinHash",
        DROP COLUMN IF EXISTS "pinFailedAttempts",
        DROP COLUMN IF EXISTS "pinLockedUntil";
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
      ON refresh_tokens ("userId");
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Farmer orchard profile data cannot be safely removed by a down migration.',
    );
  }
}
