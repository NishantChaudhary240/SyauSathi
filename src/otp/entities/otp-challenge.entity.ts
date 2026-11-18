import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OtpPurpose {
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
}

@Entity('otp_challenges')
@Index('idx_otp_challenges_phone_purpose_created', [
  'phoneNumber',
  'purpose',
  'createdAt',
])
export class OtpChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  phoneNumber!: string;

  @Column({ type: 'enum', enum: OtpPurpose, enumName: 'otp_purpose_enum' })
  purpose!: OtpPurpose;

  @Column({ type: 'varchar', length: 64 })
  otpHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
