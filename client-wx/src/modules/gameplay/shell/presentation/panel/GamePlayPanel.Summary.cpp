#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation
{
wxString GamePlayPanel::BuildHeaderText() const
{
    wxString text;
    const auto append = [&text](const std::string& value)
    {
        if (value.empty()) return;
        if (!text.empty()) text += wxString(L" - ");
        text += FromUtf8(value);
    };
    append(state_.system.setup.phase);
    append(CurrentPlayerLabel(state_));
    if (text.empty()) text = wxString(L"Partie");
    return text;
}

wxString GamePlayPanel::BuildStateSummaryText() const
{
    const auto status = state_.system.match.status.empty()
        ? std::string("?") : state_.system.match.status;
    const auto phase = state_.system.setup.phase.empty()
        ? std::string("?") : state_.system.setup.phase;
    wxString text = FromUtf8(status);
    text += wxString(L" - ") + FromUtf8(TurnLabel(state_));
    text += wxString::Format(
        L" (phase : %s, tour : %d, manche : %d)",
        FromUtf8(phase), state_.system.turn.number, state_.system.round.number);
    if (!state_.timers.empty())
    {
        text += wxString(L" - Minuteurs : ");
        bool first = true;
        for (const auto& timer : state_.timers)
        {
            if (!first) text += wxString(L", ");
            first = false;
            text += FromUtf8(timer.label.empty() ? timer.id : timer.label) +
                wxString::Format(L" %lld s",
                    std::max<std::int64_t>(0, timer.remainingMs.value_or(0)) / 1000);
        }
    }
    return text;
}

wxString GamePlayPanel::BuildPendingText() const
{
    if (!state_.pending) return wxString{};
    if (!state_.pending->label.empty()) return FromUtf8(state_.pending->label);
    if (!state_.pending->question.empty()) return FromUtf8(state_.pending->question);
    return state_.pending->type.empty()
        ? wxString{}
        : wxString(L"En attente : ") + FromUtf8(state_.pending->type);
}
}
