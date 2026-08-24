#pragma once

#include <array>
#include <cstddef>
#include <vector>

#include "modules/storybook/domain/StoryBookStats.h"

namespace lila::modules::storybook::presentation
{
class StoryBookNavigator final
{
public:
    enum class Page : std::size_t
    {
        Root,
        Games,
        Modes,
        Details,
    };

    void ResetRoot();
    void OpenGames(std::vector<domain::StoryBookGame> games);
    void Select(std::size_t index);
    [[nodiscard]] bool Activate(std::size_t index);
    [[nodiscard]] bool Back();

    [[nodiscard]] Page CurrentPage() const noexcept;
    [[nodiscard]] std::size_t SelectedIndex() const noexcept;
    [[nodiscard]] std::size_t ItemCount() const noexcept;
    [[nodiscard]] const std::vector<domain::StoryBookGame>& Games() const noexcept;
    [[nodiscard]] const domain::StoryBookGame* CurrentGame() const noexcept;
    [[nodiscard]] const domain::StoryBookCounts* CurrentCounts() const noexcept;
    [[nodiscard]] bool CurrentModeUsesBots() const noexcept;

private:
    [[nodiscard]] static constexpr std::size_t PageIndex(Page page) noexcept
    {
        return static_cast<std::size_t>(page);
    }

    Page page_ = Page::Root;
    std::vector<domain::StoryBookGame> games_;
    std::size_t gameIndex_ = 0;
    std::array<std::size_t, 4> selections_{};
};
}
