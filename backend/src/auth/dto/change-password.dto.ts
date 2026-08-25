import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Requis si mustChangePassword est false' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
