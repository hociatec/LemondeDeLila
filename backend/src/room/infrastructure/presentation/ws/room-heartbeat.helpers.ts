import { WebSocket } from 'ws';

export class RoomSocketHeartbeat {
  private readonly heartbeats = new Map<
    WebSocket,
    { timer: NodeJS.Timeout; onPong: () => void }
  >();
  private readonly lastPong = new WeakMap<WebSocket, number>();

  constructor(private readonly pingIntervalMs: number) {}

  start(client: WebSocket): void {
    this.stop(client);
    this.lastPong.set(client, Date.now());
    const onPong = () => this.lastPong.set(client, Date.now());
    client.on('pong', onPong);

    const heartbeat = setInterval(() => {
      try {
        if (client.readyState !== WebSocket.OPEN) {
          this.stop(client);
          return;
        }

        const last = this.lastPong.get(client) ?? Date.now();
        if (Date.now() - last > this.pingIntervalMs * 2) {
          this.stop(client);
          try {
            client.terminate();
          } catch {
            try {
              client.close();
            } catch {
              /* ignore */
            }
          }
          return;
        }

        client.ping();
      } catch {
        // ignore
      }
    }, this.pingIntervalMs);

    this.heartbeats.set(client, { timer: heartbeat, onPong });
  }

  stop(client: WebSocket): void {
    const heartbeat = this.heartbeats.get(client);
    if (!heartbeat) {
      return;
    }

    clearInterval(heartbeat.timer);
    client.removeListener('pong', heartbeat.onPong);
    this.heartbeats.delete(client);
  }

  stopAll(): void {
    for (const client of Array.from(this.heartbeats.keys())) this.stop(client);
  }

  get size(): number {
    return this.heartbeats.size;
  }
}
