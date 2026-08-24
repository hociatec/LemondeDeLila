#include "modules/rooms/presentation/RoomLobbyNavigator.h"

#include <algorithm>
#include <utility>

namespace lila::modules::rooms::presentation
{
void RoomLobbyNavigator::Reset(std::vector<domain::PublicRoom> rooms)
{
    rooms_ = std::move(rooms);
    selectedIndex_ = std::min(
        selectedIndex_, rooms_.empty() ? std::size_t{0} : rooms_.size() - 1);
}

void RoomLobbyNavigator::Select(std::size_t index)
{
    if (index < rooms_.size()) selectedIndex_ = index;
}

std::size_t RoomLobbyNavigator::SelectedIndex() const noexcept { return selectedIndex_; }

const std::vector<domain::PublicRoom>& RoomLobbyNavigator::Rooms() const noexcept
{
    return rooms_;
}

const domain::PublicRoom* RoomLobbyNavigator::SelectedRoom() const noexcept
{
    return selectedIndex_ < rooms_.size() ? &rooms_[selectedIndex_] : nullptr;
}
}
