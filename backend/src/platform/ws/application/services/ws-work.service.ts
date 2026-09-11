import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApplicationShutdownService } from '../../../lifecycle/public-api';

type Socket = { close(code?: number, reason?: string): void };

@Injectable()
export class WsWorkService {
  private readonly logger = new Logger(WsWorkService.name);
  constructor(
    @Inject(ApplicationShutdownService)
    private readonly shutdown = new ApplicationShutdownService(),
  ) {}

  async run(
    socket: Socket,
    work: () => void | Promise<void>,
    cleanup = false,
  ): Promise<void> {
    if (this.shutdown.isDraining && !cleanup) {
      socket.close(1012, 'Server restarting');
      return;
    }
    try {
      await this.shutdown.run(work, cleanup);
    } catch (error) {
      this.logger.error(
        'WebSocket work failed',
        error instanceof Error ? error.stack : undefined,
      );
      socket.close(1011, 'Server error');
    }
  }
}
