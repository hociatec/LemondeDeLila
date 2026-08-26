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
        if (key == 'M' && Allows(room, "room.set-role")) return "room:role";
        if (key == 'S' && Allows(room, "room.snapshot.save")) return "room:save";
        return {};
    }

    if (key == 'B')
    {
        if (shift && Allows(room, "bot.remove"))
            return "room:remove-bot";
        if (!shift && Allows(room, "bot.add"))
            return "room:add-bot";
        return {};
    }

    if (key == 'W' && Allows(room, "room.players")) return "room:players";
    if (key == 'I' && Allows(room, "room.info")) return "room:info";
    if (key == 'X' && Allows(room, "room.reset")) return "room:reset";
    if (key == 'Q' && Allows(room, "room.leave")) return "room:leave";
    return {};
}
}
