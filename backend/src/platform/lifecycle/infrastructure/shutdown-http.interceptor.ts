import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { ApplicationShutdownService } from '../application/application-shutdown.service';

@Injectable()
export class ShutdownHttpInterceptor implements NestInterceptor {
  constructor(private readonly shutdown: ApplicationShutdownService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    // The promise remains tracked even when a client aborts its HTTP connection.
    return from(
      this.shutdown.run(() =>
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }
}
