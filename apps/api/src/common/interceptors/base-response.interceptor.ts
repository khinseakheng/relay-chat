import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

export interface BaseResponse<T> {
  success: true;
  data: T;
  meta: { timestamp: string };
}

@Injectable()
export class BaseResponseInterceptor<T> implements NestInterceptor<T, T | BaseResponse<T>> {
  constructor(private readonly reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T | BaseResponse<T>> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) return next.handle();
    return next
      .handle()
      .pipe(map((data) => ({ success: true as const, data, meta: { timestamp: new Date().toISOString() } })));
  }
}
