#pragma once

#include <cstddef>
#include <vector>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::presentation
{
class RoomLobbyNavigator final
{
public:
    void Reset(std::vector<domain::PublicRoom> rooms);
    void Select(std::size_t index);

    [[nodiscard]] std::size_t SelectedIndex() const noexcept;
    [[nodiscard]] const std::vector<domain::PublicRoom>& Rooms() const noexcept;
    [[nodiscard]] const domain::PublicRoom* SelectedRoom() const noexcept;

private:
    std::vector<domain::PublicRoom> rooms_;
    std::size_t selectedIndex_ = 0;
};
}
