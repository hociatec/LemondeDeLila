#include "modules/chat/presentation/ChatFocusController.h"

#include <wx/button.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "shared/accessibility/application/FocusManager.h"
#include "shared/accessibility/application/NavigationController.h"

namespace lila::modules::chat::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;
using FocusManager = lila::shared::accessibility::FocusManager;
}

ChatFocusController::ChatFocusController(
    wxTextCtrl& input,
    wxTextCtrl& history,
    wxButton& editButton,
    wxButton& deleteButton) noexcept
    : input_(input),
      history_(history),
      editButton_(editButton),
      deleteButton_(deleteButton)
{
}

void ChatFocusController::BindNavigation(wxWindow& owner, std::function<bool()> historyActionModeProvider)
{
    Navigator::BindTabNavigation(
        owner,
        [this, historyActionModeProvider]()
        {
            wxWindow* focused = wxWindow::FindFocus();
            Navigator::Scope historyActions;
            historyActions.Add(&editButton_).Add(&deleteButton_);
            const bool actionMode = historyActionModeProvider && historyActionModeProvider();
            if (actionMode && (focused == &history_ || Navigator::Contains(historyActions, focused)))
            {
                return historyActions;
            }

            Navigator::Scope chatLoop;
            chatLoop
                .Add(&input_)
                .Add(&history_);
            return chatLoop;
        });
}

lila::shared::accessibility::FocusManager::Plan ChatFocusController::BuildComposerPlan() const
{
    FocusManager::Plan plan;
    plan.AddWindow(&input_);
    return plan;
}

lila::shared::accessibility::FocusManager::Plan ChatFocusController::BuildFirstHistoryActionPlan() const
{
    FocusManager::Plan plan;
    plan.AddScope(
        [this]()
        {
            Navigator::Scope actions;
            actions.Add(&editButton_).Add(&deleteButton_);
            return actions;
        });
    return plan;
}
}
