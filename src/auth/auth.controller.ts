import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { successResponse } from '../common/http/api-response.js';

interface AuthenticatedRequest {
  user: {
    sub: string;
  };
}

@Controller('auth')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.rotateRefreshToken(dto.refreshToken);
    return successResponse('Tokens refreshed successfully.', tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.revokeRefreshToken(dto.refreshToken);
    return successResponse('Logged out successfully.', null);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.authService.getCurrentFarmer(request.user.sub);
    return successResponse('Farmer profile retrieved successfully.', {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        fullName: user.fullName,
        district: user.district,
        municipality: user.municipality,
        wardNumber: user.wardNumber,
        treeCount: user.treeCount,
        orchardType: user.orchardType,
        profilePhoto: user.profilePhoto,
        isProfileComplete: user.isProfileComplete,
      },
    });
  }
}
