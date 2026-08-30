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
    append(state_.phase);
    append(state_.currentPlayerLabel);
    append(state_.turnLabel);
    if (text.empty()) text = wxString(L"Partie");
    return text;
}

wxString GamePlayPanel::BuildStateSummaryText() const
{
    const auto status = state_.status.empty() ? std::string("?") : state_.status;
    const auto phase = state_.phase.empty() ? std::string("?") : state_.phase;
    wxString text = FromUtf8(status);
    if (!state_.turnLabel.empty()) text += wxString(L" - ") + FromUtf8(state_.turnLabel);
    text += wxString::Format(
        L" (phase : %s, tour : %d, manche : %d)",
        FromUtf8(phase), state_.turnIndex, state_.round);
    if (state_.timers.is_object() && !state_.timers.empty())
    {
        text += wxString(L" - Minuteurs : ");
        bool first = true;
        for (const auto& timer : state_.timers.items())
        {
            if (!timer.value().is_object()) continue;
            const auto remaining = timer.value().value("remainingMs", 0LL);
            if (!first) text += wxString(L", ");
            first = false;
            text += FromUtf8(timer.key()) + wxString::Format(
                L" %lld s", std::max<long long>(0, remaining) / 1000);
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
