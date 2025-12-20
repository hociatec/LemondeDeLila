import { Injectable } from '@nestjs/common';

export type ActionLogEntry = {
  step?: string;
  actorId: number | null;
  type: string;
  payload?: any;
  timestamp: number;
};

@Injectable()
export class ActionLogService {
  append(
    log: ActionLogEntry[] = [],
    entry: Omit<ActionLogEntry, 'timestamp'>,
  ): ActionLogEntry[] {
    return [...log, { ...entry, timestamp: Date.now() }];
  }
}
