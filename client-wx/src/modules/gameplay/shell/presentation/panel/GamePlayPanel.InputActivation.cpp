#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/window.h>

#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::HandleFocusedActivation()
{
    auto* focused = wxWindow::FindFocus();
    if (handPanel_->IsShown() && focused == handPanel_->NavigationTarget())
        return ActivateSelectedHandCard();
    if (choicesList_->IsShown() && focused == choicesList_)
        return ActivateSelectedPendingChoice();
    if (focused == gridPanel_->NavigationTarget()) return ActivateSelectedGridCell();
    if (focused == linesList_ && linesList_->IsShown())
    {
        ActivateSelectedLine();
        return true;
    }
    return false;
}

void GamePlayPanel::ActivateSelectedLine()
{
    const int selection = linesList_->GetSelection();
    if (selection == wxNOT_FOUND || selection < 0 ||
        static_cast<std::size_t>(selection) >= lines_.size())
    {
        UpdateStatus(wxString(L"Aucune ligne sélectionnée."), true, true);
        return;
    }
    const auto& line = lines_[static_cast<std::size_t>(selection)];
    if (!line.enabled || line.actionIndex == domain::GameLine::NoAction ||
        line.actionIndex >= state_.actions.size())
    {
        UpdateStatus(wxString(L"Ligne informative."), false, true);
        return;
    }
    PrepareAndExecuteAction(state_.actions[line.actionIndex]);
}

bool GamePlayPanel::HandleTableShortcut(wxKeyEvent& event) const
{
    const int keyCode = event.GetKeyCode();
    const bool hasPriority = event.ControlDown() || event.AltDown() || event.MetaDown() ||
        keyCode == 'B' || keyCode == 'b' || keyCode == 'W' || keyCode == 'w' ||
        keyCode == 'R' || keyCode == 'r' || keyCode == 'Q' || keyCode == 'q' ||
        keyCode == 'X' || keyCode == 'x';
    return hasPriority && onTableShortcut_ && onTableShortcut_(event);
}
}
