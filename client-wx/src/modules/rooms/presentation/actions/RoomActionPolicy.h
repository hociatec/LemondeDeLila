#pragma once

#include <string_view>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::presentation
{
enum class RoomInterfaceAction
{
    Players,
    Information,
    Rules,
    TableAmbienceVolume,
};

enum class RoomServerAction
{
    Start,
    Reset,
    Save,
    AddBot,
    RemoveBot,
    TogglePrivacy,
    SetRole,
    SetAmbience,
    Invite,
    Kick,
    Ban,
    SetOwner,
    Leave,
};

class RoomActionPolicy final
{
public:
    [[nodiscard]] static bool AllowsServer(
        const domain::RoomState& room, RoomServerAction action) noexcept;
    [[nodiscard]] static constexpr bool AllowsInterface(RoomInterfaceAction) noexcept
    {
        return true;
    }
};
}
