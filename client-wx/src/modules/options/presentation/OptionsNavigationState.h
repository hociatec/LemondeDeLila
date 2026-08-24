#pragma once

#include <cstddef>

namespace lila::modules::options::presentation
{
class OptionsNavigationState final
{
public:
    void SetCurrentSection(std::size_t index) noexcept
    {
        currentSectionIndex = index;
    }

    void EnterSection(std::size_t index)
    {
        currentSectionIndex = index;
        insideSection = true;
    }

    std::size_t currentSectionIndex = 0;
    bool insideSection = true;

};
}
