import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export type SwaggerInfo = {
  path: string;
  jsonPath: string;
};

export function setupSwagger(app: INestApplication, publicUrl: string): SwaggerInfo | null {
  if (process.env.SWAGGER_ENABLED === 'false') return null;

  const path = (process.env.SWAGGER_PATH || 'docs').replace(/^\/+|\/+$/g, '');
  const jsonPath = `${path}/openapi.json`;
  const config = new DocumentBuilder()
    .setTitle('Relay Chat API')
    .setDescription('REST API for Relay Chat operators, conversations, visitors, and embeddable widgets.')
    .setVersion('1.0.0')
    .addServer(publicUrl, 'Current environment')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the access token returned by POST /auth/login.',
      },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Relay widget API key',
        description:
          'Enter the complete rly_live_... key generated under Widget → Security. Swagger adds the Bearer prefix automatically.',
      },
      'widget-api-key',
    )
    .addCookieAuth('relay_refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      description: 'HTTP-only refresh token set by POST /auth/login.',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup(path, app, document, {
    jsonDocumentUrl: jsonPath,
    customSiteTitle: 'Relay Chat API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  return { path, jsonPath };
}
