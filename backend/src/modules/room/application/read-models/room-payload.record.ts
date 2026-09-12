export type RoomPayloadRecord = {
  id: number;
  name: string;
  gameType: string;
  maxPlayers: number;
  isPrivate: boolean;
  status: string;
  startedAt: Date | null;
  runId: number;
  tableAmbienceSoundId: string | null;
  owner: { id: number; username: string } | null;
  participants: Array<{
    role: string;
    leftAt: Date | null;
    user: { id: number; username: string };
  }>;
  bots: Array<{ id: number; name: string }>;
};
