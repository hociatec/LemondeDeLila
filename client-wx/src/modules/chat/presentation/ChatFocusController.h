#pragma once

#include <functional>

class wxButton;
class wxListBox;
class wxTextCtrl;
class wxWindow;

namespace lila::modules::chat::presentation
{
class ChatFocusController final
{
public:
    ChatFocusController(
        wxTextCtrl& input,
        wxListBox& history,
        wxTextCtrl& emptyHistory,
        wxButton& editButton,
        wxButton& deleteButton) noexcept;

    void BindNavigation(wxWindow& owner, std::function<bool()> historyActionModeProvider);
    void FocusComposer() const;
    void FocusFirstHistoryAction() const;

private:
    wxTextCtrl& input_;
    wxListBox& history_;
    wxTextCtrl& emptyHistory_;
    wxButton& editButton_;
    wxButton& deleteButton_;
};
}
