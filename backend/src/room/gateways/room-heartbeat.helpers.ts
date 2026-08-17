import { WebSocket } from 'ws';

export class RoomSocketHeartbeat {
  private readonly heartbeats = new Map<WebSocket, NodeJS.Timeout>();
  private readonly lastPong = new WeakMap<WebSocket, number>();

  constructor(private readonly pingIntervalMs: number) {}

  start(client: WebSocket): void {
    this.stop(client);
    this.lastPong.set(client, Date.now());
    client.on('pong', () => this.lastPong.set(client, Date.now()));

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

    this.heartbeats.set(client, heartbeat);
  }

  stop(client: WebSocket): void {
    const heartbeat = this.heartbeats.get(client);
    if (!heartbeat) {
      return;
    }

    clearInterval(heartbeat);
    this.heartbeats.delete(client);
  }
}
