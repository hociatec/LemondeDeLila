#include "modules/rooms/presentation/actions/RoomActionPolicy.h"

#include <algorithm>

namespace lila::modules::rooms::presentation
{
namespace
{
constexpr std::string_view ProtocolId(RoomServerAction action) noexcept
{
    switch (action)
    {
    case RoomServerAction::Start: return "room.start";
    case RoomServerAction::Reset: return "room.reset";
    case RoomServerAction::Save: return "room.snapshot.save";
    case RoomServerAction::AddBot: return "bot.add";
    case RoomServerAction::RemoveBot: return "bot.remove";
    case RoomServerAction::TogglePrivacy: return "room.toggle-privacy";
    case RoomServerAction::SetRole: return "room.set-role";
    case RoomServerAction::SetAmbience: return "room.set-ambience";
    case RoomServerAction::Invite: return "room.invite";
    case RoomServerAction::Kick: return "room.kick";
    case RoomServerAction::Ban: return "room.ban";
    case RoomServerAction::SetOwner: return "room.set-owner";
    case RoomServerAction::Leave: return "room.leave";
    }
    return {};
}
}

bool RoomActionPolicy::AllowsServer(
    const domain::RoomState& room, RoomServerAction action) noexcept
{
    const auto id = ProtocolId(action);
    return std::find(room.allowedActions.begin(), room.allowedActions.end(), id) !=
        room.allowedActions.end();
}
}
