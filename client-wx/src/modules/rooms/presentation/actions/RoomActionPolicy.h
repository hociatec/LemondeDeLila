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

class RoomActionPolicy final
{
public:
    [[nodiscard]] static bool AllowsServer(
        const domain::RoomState& room, std::string_view action) noexcept;
    [[nodiscard]] static constexpr bool AllowsInterface(RoomInterfaceAction) noexcept
    {
        return true;
    }
};
}
