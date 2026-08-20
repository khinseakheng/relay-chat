import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChatWidgetEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspaceInvitationEntity,
  WorkspaceAuditLogEntity,
  WorkspaceMemberEntity,
  WorkspaceApiKeyEntity,
  WidgetBootstrapTokenEntity,
} from './workspace.entities';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { StorageModule } from '../storage/storage.module';

export const WORKSPACE_ENTITIES = [
  UserEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
  ChatWidgetEntity,
  WorkspaceInvitationEntity,
  WorkspaceAuditLogEntity,
  WorkspaceApiKeyEntity,
  WidgetBootstrapTokenEntity,
];

@Module({
  imports: [TypeOrmModule.forFeature(WORKSPACE_ENTITIES), StorageModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService, TypeOrmModule],
})
export class WorkspaceModule {}
