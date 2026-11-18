import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { OtpChallengeEntity } from '../otp/entities/otp-challenge.entity.js';
import { RefreshTokenEntity } from '../tokens/entities/refresh-token.entity.js';
import { UserEntity } from '../user/entities/user.entity.js';
import { CreateFarmerAuthSchema1763380000000 } from './migrations/1763380000000-CreateFarmerAuthSchema.js';
import { AddFarmerOrchardProfileFields1794912489000 } from './migrations/1794912489000-AddFarmerOrchardProfileFields.js';

const envFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) {
  loadEnvFile(envFile);
}

const requiredVariables = [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
] as const;
const missingVariables = requiredVariables.filter(
  (name) => process.env[name] === undefined,
);
if (missingVariables.length > 0) {
  throw new Error(
    `Missing PostgreSQL environment variables: ${missingVariables.join(', ')}`,
  );
}

const port = Number(process.env.DB_PORT ?? 5432);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('DB_PORT must be an integer between 1 and 65535.');
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [UserEntity, OtpChallengeEntity, RefreshTokenEntity],
  migrations: [
    CreateFarmerAuthSchema1763380000000,
    AddFarmerOrchardProfileFields1794912489000,
  ],
  synchronize: false,
});
