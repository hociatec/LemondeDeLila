import { WebSocket } from 'ws';

type PresenceHeartbeatCallbacks = {
  listSockets: () => WebSocket[];
  unregister: (socket: WebSocket) => void;
  refreshPresence: () => void;
};

export class PresenceHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly callbacks: PresenceHeartbeatCallbacks,
    private readonly pingIntervalMs = 30_000,
    private readonly pingTimeoutMs = 10_000,
  ) {}

  ensureStarted(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => this.run(), this.pingIntervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  private run(): void {
    const sockets = this.callbacks.listSockets();
    for (const socket of sockets) {
      this.ping(socket);
    }
    if (sockets.length > 0) {
      this.callbacks.refreshPresence();
      return;
    }
    this.stop();
  }

  private ping(socket: WebSocket): void {
    if (socket.readyState !== WebSocket.OPEN) {
      this.callbacks.unregister(socket);
      return;
    }
    const pongTimeout = setTimeout(
      () => this.closeUnresponsiveSocket(socket),
      this.pingTimeoutMs,
    );
    try {
      socket.ping();
      socket.once('pong', () => clearTimeout(pongTimeout));
    } catch {
      clearTimeout(pongTimeout);
      this.closeUnresponsiveSocket(socket);
    }
  }

  private closeUnresponsiveSocket(socket: WebSocket): void {
    this.callbacks.unregister(socket);
    try {
      socket.terminate?.();
    } catch {
      socket.close();
    }
  }
}
