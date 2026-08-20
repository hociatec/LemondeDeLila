#pragma once

#include <cstddef>

#include "shared/ui/navigation/NavigationStack.h"

namespace lila::modules::options::presentation
{
class OptionsNavigationState final
{
public:
    struct Snapshot final
    {
        std::size_t currentSectionIndex;
        bool insideSection;
    };

    void SetCurrentSection(std::size_t index) noexcept
    {
        currentSectionIndex = index;
    }

    void EnterSection(std::size_t index)
    {
        navigationHistory_.Push(Capture());
        currentSectionIndex = index;
        insideSection = true;
    }

    [[nodiscard]] bool GoBack() noexcept
    {
        if (navigationHistory_.Empty())
        {
            return false;
        }

        const Snapshot snapshot = navigationHistory_.Pop();
        currentSectionIndex = snapshot.currentSectionIndex;
        insideSection = snapshot.insideSection;
        return true;
    }

    [[nodiscard]] Snapshot Capture() const noexcept
    {
        return Snapshot{currentSectionIndex, insideSection};
    }

    std::size_t currentSectionIndex = 0;
    bool insideSection = false;

private:
    lila::shared::ui::navigation::NavigationStack<Snapshot> navigationHistory_;
};
}
