import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OtpPurpose } from '../../otp/entities/otp-challenge.entity.js';
import { OtpService } from '../../otp/otp.service.js';
import { TokenService } from '../../tokens/token.service.js';
import { UserRole } from '../../common/authorization/role.enum.js';
import { UserService } from '../../user/user.service.js';
import { FarmerRegistrationService } from './farmer-registration.service.js';

describe('FarmerRegistrationService', () => {
  let service: FarmerRegistrationService;
  const user = {
    id: 'farmer-id',
    phoneNumber: '+9779812345678',
    role: UserRole.FARMER,
    isActive: true,
    isProfileComplete: false,
  };
  const tokenPair = {
    accessToken: 'access',
    refreshToken: 'refresh',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
  };
  const otpService = {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
  };
  const tokenService = {
    issueTokens: vi.fn(),
  };
  const userService = {
    findByPhoneNumber: vi.fn(),
    createFarmer: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmerRegistrationService,
        { provide: OtpService, useValue: otpService },
        { provide: TokenService, useValue: tokenService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<FarmerRegistrationService>(FarmerRegistrationService);
  });

  it('sends and verifies a registration OTP before creating a farmer', async () => {
    userService.findByPhoneNumber.mockResolvedValue(null);
    userService.createFarmer.mockResolvedValue(user);
    tokenService.issueTokens.mockResolvedValue(tokenPair);

    await service.sendOtp('9812345678');
    await expect(service.verifyOtp('9812345678', '123456')).resolves.toEqual({
      tokens: tokenPair,
      user,
    });

    expect(otpService.sendOtp).toHaveBeenCalledWith(
      '+9779812345678',
      OtpPurpose.REGISTER,
    );
    expect(otpService.verifyOtp).toHaveBeenCalledWith(
      '+9779812345678',
      OtpPurpose.REGISTER,
      '123456',
    );
    expect(userService.createFarmer).toHaveBeenCalledWith('+9779812345678');
  });

  it('rejects duplicate farmer registration', async () => {
    userService.findByPhoneNumber.mockResolvedValue(user);

    await expect(service.sendOtp('9812345678')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(otpService.sendOtp).not.toHaveBeenCalled();
  });

  it('rejects a duplicate account that appears after sending the OTP', async () => {
    userService.findByPhoneNumber.mockResolvedValue(user);

    await expect(
      service.verifyOtp('9812345678', '123456'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(otpService.verifyOtp).toHaveBeenCalledWith(
      '+9779812345678',
      OtpPurpose.REGISTER,
      '123456',
    );
    expect(userService.createFarmer).not.toHaveBeenCalled();
  });
});
