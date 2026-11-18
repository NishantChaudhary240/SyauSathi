import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthorizationModule } from '../common/authorization/authorization.module.js';
import { TokenModule } from '../tokens/token.module.js';
import { UserModule } from '../user/user.module.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { AccessTokenStrategy } from './strategies/access-token.strategy.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { FarmerLoginModule } from './farmer-login/farmer-login.module.js';
import { FarmerRegistrationModule } from './farmer-registration/farmer-registration.module.js';

@Module({
  imports: [
    AuthorizationModule,
    FarmerLoginModule,
    FarmerRegistrationModule,
    PassportModule,
    TokenModule,
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AccessTokenGuard, AccessTokenStrategy, AuthService],
  exports: [AuthService],
})
export class AuthModule {}
