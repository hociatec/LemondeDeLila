#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

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
    if (!state_.pending) return wxString{};
    if (!state_.pending->label.empty()) return FromUtf8(state_.pending->label);
    if (!state_.pending->question.empty()) return FromUtf8(state_.pending->question);
    return {};
}
}
