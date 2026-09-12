export function isCurrentRoomGameRun(
  room: { gameType: string; status: string; runId: number } | null,
  gameType: string,
  runId: number | null,
): boolean {
  if (!room || room.gameType !== gameType || !Number.isSafeInteger(room.runId))
    return false;
  const status = room.status.trim().toLowerCase();
  const current =
    status === 'started'
      ? room.runId
      : status === 'setup'
        ? Math.max(0, room.runId) + 1
        : null;
  return current !== null && current === runId;
}
