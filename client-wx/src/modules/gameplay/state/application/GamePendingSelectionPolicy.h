#pragma once

#include <cstddef>
#include <optional>
#include <vector>

#include "modules/gameplay/state/domain/GamePending.h"

namespace lila::modules::gameplay::application
{
class GamePendingSelectionPolicy final
{
public:
    [[nodiscard]] static bool HasActionableChoices(const domain::GamePending& pending)
    {
        if (!pending.viewerActionable || pending.choices.empty()) return false;
        if (pending.selectionAction) return true;
        for (const auto& choice : pending.choices)
            if (choice.action) return true;
        return false;
    }

    [[nodiscard]] static std::size_t RestoreChoiceIndex(
        const std::vector<domain::GamePendingChoice>& choices,
        const std::optional<domain::GameValue>& previous)
    {
        if (previous)
            for (std::size_t index = 0; index < choices.size(); ++index)
                if (choices[index].value == *previous) return index;
        return 0;
    }

    [[nodiscard]] static std::vector<std::size_t> RestoreOrder(
        const std::vector<domain::GamePendingChoice>& choices,
        const std::vector<domain::GameValue>& previous)
    {
        std::vector<std::size_t> result;
        result.reserve(choices.size());
        std::vector<bool> inserted(choices.size(), false);
        for (const auto& value : previous)
            for (std::size_t index = 0; index < choices.size(); ++index)
                if (!inserted[index] && choices[index].value == value)
                {
                    result.push_back(index);
                    inserted[index] = true;
                    break;
                }
        for (std::size_t index = 0; index < choices.size(); ++index)
            if (!inserted[index]) result.push_back(index);
        return result;
    }
};
}
