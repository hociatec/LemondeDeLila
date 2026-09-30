#pragma once

#include <string>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"
#include "modules/gameplay/state/domain/GamePending.h"

namespace lila::modules::gameplay::application
{
class GamePendingAccessibilityText final
{
public:
    [[nodiscard]] static std::string Build(const domain::GamePending& pending)
    {
        if (!pending.label.empty()) return pending.label;
        if (!pending.question.empty()) return pending.question;

        const auto& identifier = pending.workflowKind.empty()
            ? pending.type : pending.workflowKind;
        if (identifier.empty()) return "Interaction de jeu en attente.";
        return "Interaction de jeu en attente : " +
            info::HumanLabel(identifier) + ".";
    }
};
}
