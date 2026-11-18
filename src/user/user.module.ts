import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller.js';
import { UserEntity } from './entities/user.entity.js';
import { UserService } from './user.service.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [UserService, AccessTokenGuard],
  exports: [UserService],
})
export class UserModule {}
