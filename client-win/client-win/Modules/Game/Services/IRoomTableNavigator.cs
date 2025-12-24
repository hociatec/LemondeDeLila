using client_win.Modules.Game.Models;

namespace client_win.Modules.Game.Services;

public interface IRoomTableNavigator
{
    void OpenRoom(RoomLaunchRequest request);
}
