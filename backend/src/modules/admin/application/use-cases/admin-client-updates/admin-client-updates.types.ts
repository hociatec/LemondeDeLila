export interface AdminActor {
  id: number;
  username: string;
}

export interface AdminClientUpdateAnnounceCommand {
  actor: AdminActor;
  message?: string | null;
  version?: string | null;
}

export interface AdminClientUpdateForceLatestCommand {
  actor: AdminActor;
  message?: string | null;
}

export interface AdminClientUpdateScheduleCommand {
  actor: AdminActor;
  message?: string | null;
  delayMinutes?: number | null;
  delaySeconds?: number | null;
}
