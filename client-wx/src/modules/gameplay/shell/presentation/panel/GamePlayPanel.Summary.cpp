#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/state/application/GamePendingAccessibilityText.h"

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
    return state_.pending
        ? FromUtf8(application::GamePendingAccessibilityText::Build(*state_.pending))
        : wxString{};
}
}
