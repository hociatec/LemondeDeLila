import type { RoomFocusIntent } from './room-focus-intent.ws.dto';

export type RoomIntentType =
  | 'focus'
  | 'history'
  | 'announcement'
  | 'start-wizard';

export type RoomIntent = {
  type: RoomIntentType;
  payload: RoomIntentPayload;
};

export type RoomStartWizardIntent = {
  ownerId: number | null;
  title: string;
  description: string;
  message?: string;
};

export type RoomIntentPayload =
  | RoomFocusIntent
  | RoomHistoryIntent
  | RoomAnnouncementIntent
  | RoomStartWizardIntent;

export type RoomHistoryIntent = {
  entries: string[];
  timestamp?: string;
};

export type RoomAnnouncementIntent = {
  message: string;
  priority?: 'polite' | 'assertive';
};
