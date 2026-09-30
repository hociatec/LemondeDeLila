#include "modules/gameplay/events/application/GameEventIdentityWindow.h"

#include <algorithm>

namespace lila::modules::gameplay::application
{
GameEventIdentityWindow::GameEventIdentityWindow(std::size_t capacity)
    : capacity_(std::max<std::size_t>(1, capacity))
{
}

bool GameEventIdentityWindow::Observe(std::string identity)
{
    if (identity.empty() || identities_.contains(identity)) return false;
    identities_.insert(identity);
    order_.push_back(std::move(identity));
    while (order_.size() > capacity_)
    {
        identities_.erase(order_.front());
        order_.pop_front();
    }
    return true;
}

bool GameEventIdentityWindow::Contains(std::string_view identity) const
{
    return identities_.contains(std::string(identity));
}

std::size_t GameEventIdentityWindow::Size() const noexcept
{
    return order_.size();
}

void GameEventIdentityWindow::Reset() noexcept
{
    order_.clear();
    identities_.clear();
}
}
