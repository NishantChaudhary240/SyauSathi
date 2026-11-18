import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/authorization/role.enum.js';

export enum OrchardType {
  TRADITIONAL = 'TRADITIONAL',
  HIGH_DENSITY = 'HIGH_DENSITY',
  BOTH = 'BOTH',
}

@Entity('users')
@Index('uq_users_phone_number', ['phoneNumber'], { unique: true })
@Index('idx_users_role_active', ['role', 'isActive'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  phoneNumber!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.FARMER,
    enumName: 'users_role_enum',
  })
  role!: UserRole;

  @Column({ type: 'varchar', length: 120, nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  municipality!: string | null;

  @Column({ type: 'smallint', nullable: true })
  wardNumber!: number | null;

  @Column({ type: 'integer', nullable: true })
  treeCount!: number | null;

  @Column({
    type: 'enum',
    enum: OrchardType,
    nullable: true,
    enumName: 'users_orchard_type_enum',
  })
  orchardType!: OrchardType | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  profilePhoto!: string | null;

  @Column({ type: 'boolean', default: false })
  isProfileComplete!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
