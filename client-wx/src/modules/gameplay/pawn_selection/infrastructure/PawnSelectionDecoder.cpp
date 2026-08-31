#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"

namespace lila::modules::gameplay::infrastructure
{
std::optional<domain::PawnSelection> PawnSelectionDecoder::Decode(
    const std::optional<domain::GamePending>& pending)
{
    if (!pending || pending->workflowKind != "pawn") return std::nullopt;
    domain::PawnSelection selection;
    selection.pendingType = pending->type;
    selection.label = pending->label;
    if (selection.label.empty()) selection.label = "Votre pion.";
    for (const auto& pendingChoice : pending->choices)
    {
        if (!pendingChoice.action || pendingChoice.action->type.empty() ||
            pendingChoice.action->disabled)
            continue;
        selection.choices.push_back({pendingChoice.label, *pendingChoice.action});
    }
    return selection.choices.empty() ? std::nullopt
        : std::optional<domain::PawnSelection>(std::move(selection));
}
}
