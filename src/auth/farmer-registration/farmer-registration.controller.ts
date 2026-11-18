import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { successResponse } from '../../common/http/api-response.js';
import { RequestOtpDto } from '../dto/request-otp.dto.js';
import { VerifyOtpDto } from '../dto/verify-otp.dto.js';
import { FarmerRegistrationService } from './farmer-registration.service.js';

@Controller('auth/farmer/register')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class FarmerRegistrationController {
  constructor(
    private readonly registrationService: FarmerRegistrationService,
  ) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendOtp(@Body() dto: RequestOtpDto) {
    await this.registrationService.sendOtp(dto.phoneNumber);
    return successResponse(
      'OTP request accepted. Check your phone if the number is eligible.',
      null,
    );
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const { tokens, user } = await this.registrationService.verifyOtp(
      dto.phoneNumber,
      dto.otp,
    );
    return successResponse('Farmer registered successfully.', {
      ...tokens,
      isProfileComplete: user.isProfileComplete,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  }
}
