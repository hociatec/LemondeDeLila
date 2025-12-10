export type RoomPlayer = { id: number; username: string };
export type RoomBotState = { id: number; name: string };

export type RoomPayload = {
  room: {
    id: number;
    name: string;
    isPrivate: boolean;
    maxPlayers: number;
    status: string;
    gameType: string;
    counts: {
      players: number;
      spectators: number;
    };
    owner: { id: number; username: string } | null;
    players: RoomPlayer[];
    bots: RoomBotState[];
  };
  generatedAt: string;
};

export type RoomCreatedResponse = {
  type: 'room.created';
  roomId: number;
  payload: RoomPayload;
};

export type RoomJoinedResponse = {
  type: 'room.joined';
  roomId: number;
  payload: RoomPayload;
};

export type RoomLeftResponse =
  | { type: 'room.deleted'; roomId: number }
  | { type: 'room.left'; roomId: number; payload: RoomPayload };

export type RoomStartedResponse = {
  type: 'room.started';
  roomId: number;
  payload: RoomPayload;
};

export type BotAddedResponse = {
  type: 'bot.added';
  roomId: number;
  bot: RoomBotState;
  payload: RoomPayload;
};

export type BotRemovedResponse = {
  type: 'bot.removed';
  roomId: number;
  botId: number;
  bot: RoomBotState;
  payload: RoomPayload;
};
