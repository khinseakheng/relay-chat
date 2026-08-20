import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsDateString,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkspaceDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
}

export class CreateWidgetDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() color?: string;
}

export class UpdateWidgetPolicyDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
  @ApiProperty({ enum: ['public', 'authenticated', 'hybrid'] })
  @IsIn(['public', 'authenticated', 'hybrid'])
  authenticationMode: 'public' | 'authenticated' | 'hybrid';
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(253, { each: true })
  allowedDomains: string[];
}

export class CreateApiKeyDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsUUID() widgetId: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class UpdateWidgetAppearanceDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @MinLength(2) @MaxLength(80) title: string;
  @IsHexColor() color: string;
}

export class PreChatFieldDto {
  @IsBoolean() enabled: boolean;
  @IsBoolean() required: boolean;
}

export class PreChatFieldsDto {
  @ValidateNested() @Type(() => PreChatFieldDto) name: PreChatFieldDto;
  @ValidateNested() @Type(() => PreChatFieldDto) email: PreChatFieldDto;
}

export class WidgetCustomFieldDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MinLength(1) @MaxLength(80) label: string;
  @IsIn(['text', 'email', 'select']) type: 'text' | 'email' | 'select';
  @IsBoolean() required: boolean;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) options: string[];
}

export class UpdateWidgetCustomizationDto {
  @IsString() @MaxLength(200) greeting: string;
  @IsString() @MaxLength(200) welcomeMessage: string;
  @IsIn(['sparkle', 'chat', 'logo']) launcherIcon: 'sparkle' | 'chat' | 'logo';
  @IsIn(['bottom-right', 'bottom-left']) position: 'bottom-right' | 'bottom-left';
  @IsInt() @Min(0) @Max(100) offsetX: number;
  @IsInt() @Min(0) @Max(100) offsetY: number;
  @IsIn(['light', 'dark', 'auto']) theme: 'light' | 'dark' | 'auto';
  @IsBoolean() showOnMobile: boolean;
  @IsIn(['en', 'km', 'th', 'es', 'fr']) language: string;
  @ValidateNested() @Type(() => PreChatFieldsDto) preChatFields: PreChatFieldsDto;
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WidgetCustomFieldDto)
  customFields: WidgetCustomFieldDto[];
}

export class BusinessHourDto {
  @IsInt() @Min(0) @Max(6) day: number;
  @IsBoolean() enabled: boolean;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end: string;
}

export class UpdateWidgetAvailabilityDto {
  @IsIn(['auto', 'online', 'offline']) availabilityMode: 'auto' | 'online' | 'offline';
  @IsString() @MaxLength(100) timezone: string;
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  businessHours: BusinessHourDto[];
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  holidays: string[];
  @IsBoolean() offlineFormEnabled: boolean;
  @IsString() @MaxLength(300) offlineMessage: string;
  @IsString() @MaxLength(120) expectedResponseTime: string;
  @IsInt() @Min(0) @Max(1000) maxActiveConversationsPerAgent: number;
}

export class InviteMemberDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ enum: ['admin', 'agent', 'viewer'] })
  @IsIn(['admin', 'agent', 'viewer'])
  role: 'admin' | 'agent' | 'viewer';
}

export class AcceptInvitationDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(100) password: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['admin', 'agent', 'viewer'] })
  @IsIn(['admin', 'agent', 'viewer'])
  role: 'admin' | 'agent' | 'viewer';
}

export class UpdateAttachmentPolicyDto {
  @IsInt() @Min(1) @Max(25) maxSizeMb: number;
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(['images', 'pdf', 'documents', 'spreadsheets', 'archives', 'text'], { each: true })
  allowedTypes: Array<'images' | 'pdf' | 'documents' | 'spreadsheets' | 'archives' | 'text'>;
}

export class ListAuditLogDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
