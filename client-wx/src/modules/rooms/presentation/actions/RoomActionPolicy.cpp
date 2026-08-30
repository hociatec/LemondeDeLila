#include "modules/rooms/presentation/actions/RoomActionPolicy.h"

#include <algorithm>

namespace lila::modules::rooms::presentation
{
bool RoomActionPolicy::AllowsServer(
    const domain::RoomState& room, std::string_view action) noexcept
{
    return std::find(room.allowedActions.begin(), room.allowedActions.end(), action) !=
        room.allowedActions.end();
}
}
