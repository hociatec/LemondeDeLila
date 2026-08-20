#include "modules/chat/presentation/ChatFocusController.h"

#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "shared/accessibility/NavigationController.h"

namespace lila::modules::chat::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;
}

ChatFocusController::ChatFocusController(
    wxTextCtrl& input,
    wxListBox& history,
    wxTextCtrl& emptyHistory,
    wxButton& editButton,
    wxButton& deleteButton) noexcept
    : input_(input),
      history_(history),
      emptyHistory_(emptyHistory),
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
                .Add([this]() -> wxWindow*
                {
                    return history_.IsShown() ? static_cast<wxWindow*>(&history_) : static_cast<wxWindow*>(&emptyHistory_);
                });
            return chatLoop;
        });
}

void ChatFocusController::FocusComposer() const
{
    static_cast<void>(Navigator::Focus(&input_));
}

void ChatFocusController::FocusFirstHistoryAction() const
{
    Navigator::Scope actions;
    actions.Add(&editButton_).Add(&deleteButton_);
    static_cast<void>(Navigator::FocusFirst(actions));
}
}
