#pragma once

#include <functional>

#include "shared/accessibility/application/FocusManager.h"

class wxButton;
class wxTextCtrl;
class wxWindow;

namespace lila::modules::chat::presentation
{
class ChatFocusController final
{
public:
    ChatFocusController(
        wxTextCtrl& input,
        wxTextCtrl& history,
        wxButton& editButton,
        wxButton& deleteButton) noexcept;

    void BindNavigation(wxWindow& owner, std::function<bool()> historyActionModeProvider);
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildComposerPlan() const;
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFirstHistoryActionPlan() const;

private:
    wxTextCtrl& input_;
    wxTextCtrl& history_;
    wxButton& editButton_;
    wxButton& deleteButton_;
};
}
