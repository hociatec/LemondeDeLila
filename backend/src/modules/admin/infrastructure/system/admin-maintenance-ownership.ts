import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type MaintenanceOwnership = { token: string; detached: boolean };

@Injectable()
export class AdminMaintenanceOwnership {
  private readonly storage = new AsyncLocalStorage<MaintenanceOwnership>();

  run<T>(owner: MaintenanceOwnership, operation: () => T): T {
    return this.storage.run(owner, operation);
  }

  current(): MaintenanceOwnership | undefined {
    return this.storage.getStore();
  }
}
