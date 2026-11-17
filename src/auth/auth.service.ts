import { Injectable } from '@nestjs/common';
import { TokenPair, TokenService } from '../tokens/token.service.js';
import { UserEntity } from '../user/entities/user.entity.js';

@Injectable()
export class AuthService {
  constructor(private readonly tokenService: TokenService) {}

  issueTokens(user: Pick<UserEntity, 'id' | 'role'>): Promise<TokenPair> {
    return this.tokenService.issueTokens(user);
  }

  rotateRefreshToken(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  revokeRefreshToken(refreshToken: string): Promise<void> {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }
}
