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
    pingIntervalMs = 30_000,
    pingTimeoutMs = 10_000,
  ) {
    this.pingIntervalMs = Number.isSafeInteger(pingIntervalMs)
      ? Math.min(Math.max(pingIntervalMs, 1), 300_000)
      : 30_000;
    this.pingTimeoutMs = Number.isSafeInteger(pingTimeoutMs)
      ? Math.min(Math.max(pingTimeoutMs, 1), this.pingIntervalMs)
      : 10_000;
  }

  private pingIntervalMs: number;
  private pingTimeoutMs: number;

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
