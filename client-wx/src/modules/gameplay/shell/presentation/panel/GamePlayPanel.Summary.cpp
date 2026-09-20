#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation
{
wxString GamePlayPanel::BuildHeaderText() const
{
    return gameName_.empty() ? wxString{} : FromUtf8(gameName_);
}

wxString GamePlayPanel::BuildStateSummaryText() const
{
    return {};
}

wxString GamePlayPanel::BuildPendingText() const
{
    if (state_.pending)
    {
        if (!state_.pending->label.empty()) return FromUtf8(state_.pending->label);
        if (!state_.pending->question.empty()) return FromUtf8(state_.pending->question);
    }

    if (gameType_ != "arche-de-mnemosyne" || state_.system.match.status != "playing")
        return {};
    const bool questionInProgress = state_.kits.quiz && std::any_of(
        state_.kits.quiz->sessions.begin(), state_.kits.quiz->sessions.end(),
        [](const domain::GameQuizSession& session) { return session.phase == "answering"; });
    if (questionInProgress) return {};

    const auto player = CurrentPlayerLabel(state_);
    return player.empty() ? wxString{} : FromUtf8(
        "C’est à " + player + " de piocher une question.");
}
}
