import { Injectable } from '@nestjs/common';
import { TokenPair, TokenService } from '../tokens/token.service.js';
import { UserEntity } from '../user/entities/user.entity.js';
import { UserService } from '../user/user.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
  ) {}

  async getCurrentFarmer(id: string): Promise<UserEntity> {
    return this.userService.findActiveFarmerById(id);
  }

  rotateRefreshToken(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  revokeRefreshToken(refreshToken: string): Promise<void> {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }
}
