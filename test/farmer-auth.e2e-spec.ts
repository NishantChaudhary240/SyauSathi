import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { FarmerLoginController } from '../src/auth/farmer-login/farmer-login.controller.js';
import { FarmerLoginService } from '../src/auth/farmer-login/farmer-login.service.js';
import { FarmerRegistrationController } from '../src/auth/farmer-registration/farmer-registration.controller.js';
import { FarmerRegistrationService } from '../src/auth/farmer-registration/farmer-registration.service.js';
import { AccessTokenGuard } from '../src/auth/guards/access-token.guard.js';
import { AccessTokenStrategy } from '../src/auth/strategies/access-token.strategy.js';
import { UserRole } from '../src/common/authorization/role.enum.js';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { OrchardType } from '../src/user/entities/user.entity.js';
import { UserController } from '../src/user/user.controller.js';
import { UserService } from '../src/user/user.service.js';

describe('Farmer authentication API (e2e)', () => {
  let app: NestFastifyApplication;
  const farmer = {
    id: 'farmer-id',
    phoneNumber: '+9779812345678',
    role: UserRole.FARMER,
    fullName: 'डोल्मा गुरुङ',
    district: 'मुस्ताङ',
    municipality: 'घरपझोङ गाउँपालिका',
    wardNumber: 4,
    treeCount: 40,
    orchardType: OrchardType.TRADITIONAL,
    profilePhoto: null,
    isProfileComplete: true,
    isActive: true,
  };
  const authService = {
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    getCurrentFarmer: vi.fn(),
  };
  const registrationService = {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
  };
  const loginService = {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
  };
  const userService = {
    findActiveFarmerById: vi.fn(),
    completeFarmerProfile: vi.fn(),
  };
  let jwtService: JwtService;
  const jwtSecret = 'farmer-auth-e2e-secret-with-at-least-32-bytes';

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = jwtSecret;
    authService.getCurrentFarmer.mockResolvedValue(farmer);
    userService.findActiveFarmerById.mockResolvedValue(farmer);
    userService.completeFarmerProfile.mockResolvedValue(farmer);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: jwtSecret })],
      controllers: [
        AuthController,
        FarmerLoginController,
        FarmerRegistrationController,
        UserController,
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: FarmerLoginService, useValue: loginService },
        { provide: FarmerRegistrationService, useValue: registrationService },
        { provide: UserService, useValue: userService },
        AccessTokenGuard,
        AccessTokenStrategy,
      ],
    }).compile();

    jwtService = moduleFixture.get(JwtService);
    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.JWT_ACCESS_SECRET;
  });

  it('accepts a farmer registration OTP request (including Devanagari digits) with the shared response shape', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/farmer/register/send-otp',
      payload: { phoneNumber: '९८१२३ ४५६७८' },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      success: true,
      message:
        'OTP request accepted. Check your phone if the number is eligible.',
      data: null,
    });
    expect(registrationService.sendOtp).toHaveBeenCalledWith('98123 45678');
  });

  it('rejects role escalation fields in registration verification', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/farmer/register/verify-otp',
      payload: {
        phoneNumber: '9812345678',
        otp: '123456',
        role: 'ADMIN',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, data: null });
    expect(registrationService.verifyOtp).not.toHaveBeenCalled();
  });

  it('keeps the login OTP response generic and verifies OTP login', async () => {
    const sendResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/farmer/login/send-otp',
      payload: { phoneNumber: '9812345678' },
    });
    expect(sendResponse.statusCode).toBe(202);
    expect(sendResponse.json()).toEqual({
      success: true,
      message:
        'OTP request accepted. Check your phone if the number is eligible.',
      data: null,
    });
    expect(loginService.sendOtp).toHaveBeenCalledWith('9812345678');

    loginService.verifyOtp.mockResolvedValue({
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      },
      user: farmer,
    });

    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/farmer/login/verify-otp',
      payload: { phoneNumber: '9812345678', otp: '४७२९१०' },
    });
    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      success: true,
      data: {
        accessToken: 'access',
        isProfileComplete: true,
        user: { id: farmer.id, role: UserRole.FARMER },
      },
    });
    expect(loginService.verifyOtp).toHaveBeenCalledWith('9812345678', '472910');
  });

  it('returns the authenticated farmer at the current-user endpoint', async () => {
    const token = await createAccessToken();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        user: {
          id: farmer.id,
          role: UserRole.FARMER,
          district: 'मुस्ताङ',
          treeCount: 40,
          orchardType: OrchardType.TRADITIONAL,
        },
      },
    });
    expect(authService.getCurrentFarmer).toHaveBeenCalledWith(farmer.id);
  });

  it('rejects missing and non-farmer access tokens', async () => {
    const missingTokenResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(missingTokenResponse.statusCode).toBe(401);

    const adminToken = await createAccessToken(UserRole.ADMIN);
    const adminTokenResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminTokenResponse.statusCode).toBe(401);

    const expiredToken = await jwtService.signAsync(
      { sub: farmer.id, role: UserRole.FARMER },
      { expiresIn: '-1s' },
    );
    const expiredTokenResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    expect(expiredTokenResponse.statusCode).toBe(401);
  });

  it('completes the farmer profile with only district required or with full orchard details', async () => {
    const unauthResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/users/farmer/complete-profile',
      payload: {
        district: 'मुस्ताङ',
      },
    });
    expect(unauthResponse.statusCode).toBe(401);

    const token = await createAccessToken();
    const districtOnlyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/users/farmer/complete-profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        district: 'मुस्ताङ',
      },
    });
    expect(districtOnlyResponse.statusCode).toBe(200);
    expect(userService.completeFarmerProfile).toHaveBeenCalledWith(
      farmer.id,
      expect.objectContaining({ district: 'मुस्ताङ' }),
    );

    const fullProfileResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/users/farmer/complete-profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fullName: 'डोल्मा गुरुङ',
        district: 'मुस्ताङ',
        municipality: 'घरपझोङ गाउँपालिका',
        wardNumber: 4,
        treeCount: '४०',
        orchardType: OrchardType.TRADITIONAL,
      },
    });
    expect(fullProfileResponse.statusCode).toBe(200);
    expect(fullProfileResponse.json()).toMatchObject({
      success: true,
      data: {
        user: {
          id: farmer.id,
          role: UserRole.FARMER,
          isProfileComplete: true,
          treeCount: 40,
          orchardType: OrchardType.TRADITIONAL,
        },
      },
    });
    expect(userService.completeFarmerProfile).toHaveBeenLastCalledWith(
      farmer.id,
      expect.objectContaining({
        fullName: 'डोल्मा गुरुङ',
        district: 'मुस्ताङ',
        municipality: 'घरपझोङ गाउँपालिका',
        wardNumber: 4,
        treeCount: 40,
        orchardType: OrchardType.TRADITIONAL,
      }),
    );
  });

  it('rejects attempts to choose a profile owner or modify role/status', async () => {
    const token = await createAccessToken();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/users/farmer/complete-profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        district: 'Kaski',
        userId: 'another-farmer',
        role: 'ADMIN',
        isActive: false,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, data: null });
    expect(userService.completeFarmerProfile).not.toHaveBeenCalled();
  });

  async function createAccessToken(role = UserRole.FARMER): Promise<string> {
    return jwtService.signAsync({ sub: farmer.id, role }, { expiresIn: 900 });
  }
});
