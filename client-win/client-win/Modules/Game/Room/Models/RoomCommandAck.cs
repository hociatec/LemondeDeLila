namespace client_win.Modules.Game.Room.Services;

public sealed record RoomCommandAck(
    string Action,
    string TraceId,
    long ReceivedAtMs,
    long ClientToServerMs);
