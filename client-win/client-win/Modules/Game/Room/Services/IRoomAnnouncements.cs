namespace client_win.Modules.Game.Room.Services;

public interface IRoomAnnouncements
{
    event System.Action<RoomAnnouncement>? Announced;
    void ShortcutKey(string key);
    void BotJoined(string botName);
    void BotLeft(string botName);
    void PlayerJoined(string username, bool spectator);
    void PlayerLeft(string username, bool spectator);
    void OwnerChanged(string username);
    void PlayersList(string message);
    void TableInfo(string message);
    void VisibilityChanged(bool isPrivate);
    void RoleChanged(bool isSpectator);
    void Error(string message);
}
