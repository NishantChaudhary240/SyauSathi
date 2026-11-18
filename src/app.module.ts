import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';

function getDatabaseOptions(): TypeOrmModuleOptions {
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

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    autoLoadEntities: true,
    synchronize: false,
  };
}

@Module({
  imports: [TypeOrmModule.forRoot(getDatabaseOptions()), AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
