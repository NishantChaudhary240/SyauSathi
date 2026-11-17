import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { TokenService } from '../tokens/token.service.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: TokenService,
          useValue: {
            issueTokens: vi.fn(),
            rotateRefreshToken: vi.fn(),
            revokeRefreshToken: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
