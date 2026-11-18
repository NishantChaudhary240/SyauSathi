import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+\d\s().-]{8,20}$/)
  phoneNumber!: string;
}
