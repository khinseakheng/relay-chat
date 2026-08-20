import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { BaseResponseInterceptor } from './common/interceptors/base-response.interceptor';
import { createDatabaseConfig } from './database/database.config';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRoot(
      createDatabaseConfig({
        migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
        synchronize: false,
      }),
    ),
    CacheModule.register({ isGlobal: true, ttl: 10_000, max: 100 }),
    WorkspaceModule,
    AuthModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: BaseResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
