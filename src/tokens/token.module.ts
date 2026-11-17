import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { TokenService } from './token.service.js';
import { UserEntity } from '../user/entities/user.entity.js';

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }),
    TypeOrmModule.forFeature([RefreshTokenEntity, UserEntity]),
  ],
  providers: [TokenService],
  exports: [JwtModule, TokenService],
})
export class TokenModule {}
