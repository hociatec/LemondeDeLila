#include "modules/gameplay/pawn_selection/application/PawnSelectionPolicy.h"

namespace lila::modules::gameplay::application
{
std::optional<domain::PawnSelection> PawnSelectionPolicy::FromPending(
    const std::optional<domain::GamePending>& pending)
{
    if (!pending || pending->workflowKind != "pawn") return std::nullopt;
    domain::PawnSelection selection;
    selection.pendingType = pending->type;
    selection.label = pending->label.empty() ? "Choisissez votre pion." : pending->label;
    for (const auto& choice : pending->choices)
        if (choice.action && !choice.action->type.empty() && !choice.action->disabled)
            selection.choices.push_back({choice.label, *choice.action});
    return selection.choices.empty() ? std::nullopt
        : std::optional<domain::PawnSelection>(std::move(selection));
}
}
