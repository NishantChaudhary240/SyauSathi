import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../common/authorization/role.enum.js';
import { CompleteFarmerProfileDto } from './dto/complete-farmer-profile.dto.js';
import { UserEntity } from './entities/user.entity.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  findByPhoneNumber(phoneNumber: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { phoneNumber } });
  }

  async createFarmer(phoneNumber: string): Promise<UserEntity> {
    const user = this.userRepository.create({
      phoneNumber,
      role: UserRole.FARMER,
      fullName: null,
      district: null,
      municipality: null,
      wardNumber: null,
      treeCount: null,
      orchardType: null,
      profilePhoto: null,
      isProfileComplete: false,
      isActive: true,
    });

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        typeof error.driverError === 'object' &&
        error.driverError !== null &&
        'code' in error.driverError &&
        error.driverError.code === '23505'
      ) {
        throw new ConflictException('A farmer account already exists.');
      }
      throw error;
    }
  }

  async findActiveFarmerById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id, role: UserRole.FARMER, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('Farmer account is unavailable.');
    }
    return user;
  }

  async completeFarmerProfile(
    id: string,
    profile: CompleteFarmerProfileDto,
  ): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id, role: UserRole.FARMER, isActive: true },
    });
    if (!user) {
      throw new NotFoundException('Farmer account not found.');
    }

    user.fullName = profile.fullName ?? null;
    user.district = profile.district;
    user.municipality = profile.municipality ?? null;
    user.wardNumber = profile.wardNumber ?? null;
    user.treeCount = profile.treeCount ?? null;
    user.orchardType = profile.orchardType ?? null;
    user.profilePhoto = profile.profilePhoto ?? null;
    user.isProfileComplete = true;
    return this.userRepository.save(user);
  }
}
