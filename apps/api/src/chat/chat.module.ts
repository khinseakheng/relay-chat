import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  ConversationEntity,
  ConversationNoteEntity,
  ConversationTagEntity,
  MessageEntity,
  PresenceSessionEntity,
} from './entities';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { WidgetService } from './widget.service';
import { WidgetSessionsController } from './widget-sessions.controller';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationEntity,
      MessageEntity,
      PresenceSessionEntity,
      ConversationTagEntity,
      ConversationNoteEntity,
    ]),
    AuthModule,
    StorageModule,
    WorkspaceModule,
  ],
  controllers: [ChatController, WidgetSessionsController],
  providers: [ChatService, ChatGateway, ChatRepository, WidgetService],
})
export class ChatModule {}
