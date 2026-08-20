import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParserModule from 'cookie-parser';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { resolve } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const publicUrl = config.get<string>('API_PUBLIC_URL', `http://localhost:${port}`).replace(/\/$/, '');
  const allowedOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use(cookieParserModule());
  if (config.get<string>('STORAGE_DRIVER', 'local') === 'local') {
    app.useStaticAssets(resolve(config.get<string>('STORAGE_LOCAL_PATH', 'uploads')), {
      prefix: '/uploads/',
    });
  }
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const swagger = setupSwagger(app, publicUrl);
  await app.listen(port);

  console.log(`\n🚀 Relay API:      ${publicUrl}`);
  if (swagger) {
    console.log(`📚 Swagger UI:    ${publicUrl}/${swagger.path}`);
    console.log(`📄 OpenAPI JSON:  ${publicUrl}/${swagger.jsonPath}\n`);
  } else {
    console.log('📚 Swagger:       disabled (SWAGGER_ENABLED=false)\n');
  }
}
bootstrap();
