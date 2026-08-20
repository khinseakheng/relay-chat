import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  MinLength,
  Max,
  MaxLength,
  Min,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
  @ApiPropertyOptional({ default: 'demo' }) @IsOptional() @IsString() @MaxLength(80) siteId?: string;
  @ApiProperty() @IsString() widgetToken: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) page?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) initialMessage?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() customFields?: Record<string, string>;
}

export class CreateExternalWidgetSessionDto {
  @ApiProperty() @IsString() @MaxLength(80) siteId: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) externalUserId: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, string>;
}

export class ExchangeWidgetSessionDto {
  @ApiProperty() @IsString() token: string;
}
export class ListConversationsDto {
  @IsOptional() @IsString() @MaxLength(200) q = '';
  @IsOptional() @IsIn(['all', 'open', 'closed']) status: 'all' | 'open' | 'closed' = 'all';
  @IsOptional() @IsIn(['newest', 'oldest']) sort: 'newest' | 'oldest' = 'newest';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 30;
}
export class VisitorProfileDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}
export class NoteDto {
  @ApiProperty() @IsString() id: string;
  @ApiProperty() @IsString() @MaxLength(1000) text: string;
  @ApiProperty() @IsString() createdAt: string;
  @ApiProperty() @IsString() author: string;
}
export class UpdateConversationDto {
  @IsOptional() @IsIn(['open', 'closed']) status?: 'open' | 'closed';
  @IsOptional() @IsUUID() assignedMemberId?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(9999) unread?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NoteDto) notes?: NoteDto[];
  @IsOptional() @IsString() @MaxLength(100) visitorName?: string;
  @IsOptional() @IsEmail() visitorEmail?: string;
}
