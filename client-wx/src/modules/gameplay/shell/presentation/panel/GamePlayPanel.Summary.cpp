#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

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
    if (state_.botThinking) text += wxString(L" - Un bot réfléchit.");
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
