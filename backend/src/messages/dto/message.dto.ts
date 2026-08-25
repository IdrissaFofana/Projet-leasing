import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty()
  @IsString()
  destinataireId!: string;

  @ApiPropertyOptional({ default: 'Message' })
  @IsOptional()
  @IsString()
  sujet?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  corps!: string;
}
