import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../../common/authorization/role.enum.js';
import { UserService } from '../../user/user.service.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_ACCESS_SECRET must be configured before registering AuthModule.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      payload.role !== UserRole.FARMER
    ) {
      throw new UnauthorizedException();
    }
    const user = await this.userService.findActiveFarmerById(payload.sub);
    return { sub: user.id, role: user.role };
  }
}
