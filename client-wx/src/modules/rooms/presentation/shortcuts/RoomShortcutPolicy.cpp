#include "modules/rooms/presentation/shortcuts/RoomShortcutPolicy.h"

#include <algorithm>

namespace lila::modules::rooms::presentation
{
namespace
{
bool Allows(const domain::RoomState& room, std::string_view action)
{
    return std::find(room.allowedActions.begin(), room.allowedActions.end(), action) !=
        room.allowedActions.end();
}

bool IsStarted(const domain::RoomState& room)
{
    return room.started || room.status == "started";
}
}

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
        if (key == 'H' && Allows(room, "room.toggle-privacy")) return "room:privacy";
        if (key == 'M' && !IsStarted(room) && Allows(room, "room.set-role")) return "room:role";
        if (key == 'S' && Allows(room, "room.snapshot.save")) return "room:save";
        return {};
    }

    if (key == 'B')
    {
        if (shift && !IsStarted(room) && Allows(room, "bot.remove") && !room.bots.empty())
            return "room:remove-bot";
        if (!shift && !IsStarted(room) && Allows(room, "bot.add") &&
            room.players.size() + room.bots.size() < static_cast<std::size_t>(room.maxPlayers))
            return "room:add-bot";
        return {};
    }

    if (key == 'W' && Allows(room, "room.players")) return "room:players";
    if (key == 'I' && !IsStarted(room) && Allows(room, "room.info")) return "room:info";
    if (key == 'X' && Allows(room, "room.reset")) return "room:reset";
    if (key == 'Q' && Allows(room, "room.leave")) return "room:leave";
    return {};
}
}
