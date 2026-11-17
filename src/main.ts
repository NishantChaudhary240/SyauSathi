import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';

const envFile = resolve(import.meta.dirname, '../.env');
if (existsSync(envFile)) {
  loadEnvFile(envFile);
}

const { AppModule } = await import('./app.module.js');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
