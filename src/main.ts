import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';

const envFile = resolve(import.meta.dirname, '../.env');
if (existsSync(envFile)) {
  loadEnvFile(envFile);
}

const { AppModule } = await import('./app.module.js');

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter({ trustProxy: process.env.TRUST_PROXY === 'true' }),
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  await app.listen(port, process.env.HOST ?? '0.0.0.0');
}
await bootstrap();
