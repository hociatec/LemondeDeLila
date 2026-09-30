#pragma once

#include <cstddef>
#include <deque>
#include <string>
#include <string_view>
#include <unordered_set>

namespace lila::modules::gameplay::application
{
class GameEventIdentityWindow final
{
public:
    explicit GameEventIdentityWindow(std::size_t capacity = 1'024);
    [[nodiscard]] bool Observe(std::string identity);
    [[nodiscard]] bool Contains(std::string_view identity) const;
    [[nodiscard]] std::size_t Size() const noexcept;
    void Reset() noexcept;

private:
    std::size_t capacity_;
    std::deque<std::string> order_;
    std::unordered_set<std::string> identities_;
};
}
