import { Injectable } from '@nestjs/common';
import { AdminClientUpdateAnnounceService } from './admin-client-update-announce.service';
import { AdminClientUpdateForceLatestService } from './admin-client-update-force-latest.service';
import { AdminClientUpdateSchedulerService } from './admin-client-update-scheduler.service';
import type {
  AdminClientUpdateAnnounceCommand,
  AdminClientUpdateForceLatestCommand,
  AdminClientUpdateScheduleCommand,
} from './admin-client-updates.types';

@Injectable()
export class AdminClientUpdatesDispatchService {
  constructor(
    private readonly announceService: AdminClientUpdateAnnounceService,
    private readonly forceLatestService: AdminClientUpdateForceLatestService,
    private readonly schedulerService: AdminClientUpdateSchedulerService,
  ) {}

  async announceAvailable(command: AdminClientUpdateAnnounceCommand) {
    return this.announceService.execute(command);
  }

  async forceLatest(command: AdminClientUpdateForceLatestCommand) {
    return this.forceLatestService.execute(command);
  }

  async scheduleForcedUpdate(command: AdminClientUpdateScheduleCommand) {
    return this.schedulerService.schedule(command);
  }
}
