import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { successResponse } from '../common/http/api-response.js';
import { CompleteFarmerProfileDto } from './dto/complete-farmer-profile.dto.js';
import { UserService } from './user.service.js';

interface AuthenticatedRequest {
  user: {
    sub: string;
  };
}

@Controller('users/farmer')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('complete-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async completeProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CompleteFarmerProfileDto,
  ) {
    const user = await this.userService.completeFarmerProfile(
      request.user.sub,
      dto,
    );
    return successResponse('Farmer profile completed successfully.', {
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
