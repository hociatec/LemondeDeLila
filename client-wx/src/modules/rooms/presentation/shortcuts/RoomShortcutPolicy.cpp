#include "modules/rooms/presentation/shortcuts/RoomShortcutPolicy.h"

#include "modules/rooms/presentation/actions/RoomActionPolicy.h"

namespace lila::modules::rooms::presentation
{
std::string_view RoomShortcutPolicy::Resolve(
    int key,
    bool control,
    bool alt,
    bool meta,
    bool shift,
    const domain::RoomState& room) noexcept
{
    if (alt || meta) return {};

    if (control)
    {
        if (shift) return {};
        if (key == 'H' && RoomActionPolicy::AllowsServer(room, RoomServerAction::TogglePrivacy)) return "room:privacy";
        if (key == 'M' && RoomActionPolicy::AllowsServer(room, RoomServerAction::SetRole)) return "room:role";
        if (key == 'S' && RoomActionPolicy::AllowsServer(room, RoomServerAction::Save)) return "room:save";
        if (key == 'A' && RoomActionPolicy::AllowsServer(room, RoomServerAction::SetAmbience)) return "room:ambience";
        if (key == 'V' && RoomActionPolicy::AllowsInterface(
                RoomInterfaceAction::TableAmbienceVolume)) return "room:ambience-volume";
        if (key == 'I' && RoomActionPolicy::AllowsServer(room, RoomServerAction::Invite)) return "room:invite";
        if (key == 'K' && RoomActionPolicy::AllowsServer(room, RoomServerAction::Kick)) return "room:kick";
        if (key == 'B' && RoomActionPolicy::AllowsServer(room, RoomServerAction::Ban)) return "room:ban";
        if (key == 'P' && RoomActionPolicy::AllowsServer(room, RoomServerAction::SetOwner)) return "room:set-owner";
        return {};
    }

    if (key == 'B')
    {
        if (shift && RoomActionPolicy::AllowsServer(room, RoomServerAction::RemoveBot))
            return "room:remove-bot";
        if (!shift && RoomActionPolicy::AllowsServer(room, RoomServerAction::AddBot))
            return "room:add-bot";
        return {};
    }

    if (key == 'W' && RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Players))
        return "room:players";
    if (key == 'I' && RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Information))
        return "room:info";
    if (key == 'R' && RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Rules))
        return "room:rules";
    if (key == 'X' && RoomActionPolicy::AllowsServer(room, RoomServerAction::Reset)) return "room:reset";
    if (key == 'Q' && RoomActionPolicy::AllowsServer(room, RoomServerAction::Leave)) return "room:leave";
    return {};
}
}
