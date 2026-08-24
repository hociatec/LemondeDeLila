#pragma once

#include <array>
#include <cstddef>
#include <vector>

#include "modules/leaderboard/domain/Leaderboard.h"

namespace lila::modules::leaderboard::presentation
{
class LeaderboardNavigator final
{
public:
    enum class Page : std::size_t
    {
        Games,
        Top,
    };

    void ResetGames(std::vector<domain::LeaderboardGame> games);
    void ShowGames() noexcept;
    void OpenTop(std::size_t gameIndex, domain::LeaderboardTop top);
    void Select(std::size_t index);
    [[nodiscard]] bool Back() noexcept;

    [[nodiscard]] Page CurrentPage() const noexcept;
    [[nodiscard]] std::size_t SelectedIndex() const noexcept;
    [[nodiscard]] std::size_t ItemCount() const noexcept;
    [[nodiscard]] const std::vector<domain::LeaderboardGame>& Games() const noexcept;
    [[nodiscard]] const domain::LeaderboardGame* CurrentGame() const noexcept;
    [[nodiscard]] const std::vector<domain::LeaderboardEntry>& Entries() const noexcept;

private:
    [[nodiscard]] static constexpr std::size_t PageIndex(Page page) noexcept
    {
        return static_cast<std::size_t>(page);
    }

    Page page_ = Page::Games;
    std::vector<domain::LeaderboardGame> games_;
    std::vector<domain::LeaderboardEntry> entries_;
    std::size_t gameIndex_ = 0;
    std::array<std::size_t, 2> selections_{};
};
}
