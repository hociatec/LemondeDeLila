export type RoomFocusIntentRegion = 'game' | 'history' | 'chat';
export type RoomFocusIntentPriority = 'default' | 'assertive';

export type RoomFocusIntent = {
  region: RoomFocusIntentRegion;
  reason?: string;
  priority?: RoomFocusIntentPriority;
  announce?: boolean;
};
