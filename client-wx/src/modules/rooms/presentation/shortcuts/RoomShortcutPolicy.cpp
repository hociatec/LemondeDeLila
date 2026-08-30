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
        if (key == 'H' && RoomActionPolicy::AllowsServer(room, "room.toggle-privacy")) return "room:privacy";
        if (key == 'M' && RoomActionPolicy::AllowsServer(room, "room.set-role")) return "room:role";
        if (key == 'S' && RoomActionPolicy::AllowsServer(room, "room.snapshot.save")) return "room:save";
        if (key == 'A' && RoomActionPolicy::AllowsServer(room, "room.set-ambience")) return "room:ambience";
        if (key == 'V' && RoomActionPolicy::AllowsInterface(
                RoomInterfaceAction::TableAmbienceVolume)) return "room:ambience-volume";
        if (key == 'I' && RoomActionPolicy::AllowsServer(room, "room.invite")) return "room:invite";
        if (key == 'K' && RoomActionPolicy::AllowsServer(room, "room.kick")) return "room:kick";
        if (key == 'B' && RoomActionPolicy::AllowsServer(room, "room.ban")) return "room:ban";
        if (key == 'P' && RoomActionPolicy::AllowsServer(room, "room.set-owner")) return "room:set-owner";
        return {};
    }

    if (key == 'B')
    {
        if (shift && RoomActionPolicy::AllowsServer(room, "bot.remove"))
            return "room:remove-bot";
        if (!shift && RoomActionPolicy::AllowsServer(room, "bot.add"))
            return "room:add-bot";
        return {};
    }

    if (key == 'W' && RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Players))
        return "room:players";
    if (key == 'I' && RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Information))
        return "room:info";
    if (key == 'R' && RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Rules))
        return "room:rules";
    if (key == 'X' && RoomActionPolicy::AllowsServer(room, "room.reset")) return "room:reset";
    if (key == 'Q' && RoomActionPolicy::AllowsServer(room, "room.leave")) return "room:leave";
    return {};
}
}
