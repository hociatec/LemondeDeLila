using client_win.Modules.Game.Sessions;

namespace client_win.Modules.Game.Services;

public interface IRoomSessionFactory
{
    RoomSession Create();
}
