import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    if (host.getType() === 'ws') {
      const client = host.switchToWs().getClient<{ emit(event: string, payload: unknown): void }>();
      client.emit('exception', {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Realtime request failed' },
      });
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = error instanceof HttpException ? error.getResponse() : null;
    const objectPayload =
      typeof payload === 'object' && payload !== null
        ? (payload as { message?: string | string[] })
        : undefined;
    const message =
      typeof payload === 'string'
        ? payload
        : objectPayload?.message || (error instanceof Error ? error.message : 'Internal server error');
    if (status >= 500)
      this.logger.error(
        `${request.method} ${request.url}`,
        error instanceof Error ? error.stack : String(error),
      );
    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message: Array.isArray(message) ? message : [message],
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
