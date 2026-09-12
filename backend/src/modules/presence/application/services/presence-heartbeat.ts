import { WebSocket } from 'ws';

type PresenceHeartbeatCallbacks = {
  listSockets: () => WebSocket[];
  unregister: (socket: WebSocket) => void;
  refreshPresence: () => void;
};

export class PresenceHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly pendingPings = new Map<WebSocket, () => void>();

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
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const cleanup of this.pendingPings.values()) cleanup();
  }

  cancel(socket: WebSocket): void {
    this.pendingPings.get(socket)?.();
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
      this.cancel(socket);
      this.callbacks.unregister(socket);
      return;
    }
    if (this.pendingPings.has(socket)) {
      this.closeUnresponsiveSocket(socket);
      return;
    }
    const pongTimeout = setTimeout(
      () => this.closeUnresponsiveSocket(socket),
      this.pingTimeoutMs,
    );
    const cleanup = () => {
      clearTimeout(pongTimeout);
      socket.off('pong', cleanup);
      socket.off('close', cleanup);
      this.pendingPings.delete(socket);
    };
    this.pendingPings.set(socket, cleanup);
    try {
      socket.once('pong', cleanup);
      socket.once('close', cleanup);
      socket.ping();
    } catch {
      this.closeUnresponsiveSocket(socket);
    }
  }

  private closeUnresponsiveSocket(socket: WebSocket): void {
    this.cancel(socket);
    this.callbacks.unregister(socket);
    try {
      socket.terminate?.();
    } catch {
      socket.close();
    }
  }
}
