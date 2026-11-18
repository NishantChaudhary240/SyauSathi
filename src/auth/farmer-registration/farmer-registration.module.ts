import { Module } from '@nestjs/common';
import { OtpModule } from '../../otp/otp.module.js';
import { TokenModule } from '../../tokens/token.module.js';
import { UserModule } from '../../user/user.module.js';
import { FarmerRegistrationController } from './farmer-registration.controller.js';
import { FarmerRegistrationService } from './farmer-registration.service.js';

@Module({
  imports: [OtpModule, TokenModule, UserModule],
  controllers: [FarmerRegistrationController],
  providers: [FarmerRegistrationService],
})
export class FarmerRegistrationModule {}
