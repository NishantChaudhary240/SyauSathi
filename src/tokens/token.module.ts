import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { TokenService } from './token.service.js';
import { UserEntity } from '../user/entities/user.entity.js';

function getJwtAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error(
      'JWT_ACCESS_SECRET must contain at least 32 bytes before registering TokenModule.',
    );
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.register({ secret: getJwtAccessSecret() }),
    TypeOrmModule.forFeature([RefreshTokenEntity, UserEntity]),
  ],
  providers: [TokenService],
  exports: [JwtModule, TokenService],
})
export class TokenModule {}
