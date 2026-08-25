#pragma once

#include <string_view>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::presentation
{
class RoomShortcutPolicy final
{
public:
    [[nodiscard]] static std::string_view Resolve(
        int key,
        bool control,
        bool alt,
        bool meta,
        bool shift,
        const domain::RoomState& room) noexcept;
};
}
