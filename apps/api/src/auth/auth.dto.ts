import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'secure-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ example: 'Alex Morgan' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class AcceptInviteDto extends LoginDto {
  @ApiProperty({ example: 'Alex Morgan' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}
