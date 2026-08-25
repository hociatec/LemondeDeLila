#pragma once

#include <functional>
#include <optional>
#include <vector>

#include <wx/panel.h>
#include <wx/weakref.h>

#include "modules/gameplay/actions/domain/GameAction.h"

class wxButton;
class wxKeyEvent;
class wxStaticText;
class wxWindow;

namespace lila::modules::gameplay::presentation::confirmation
{
class GameActionConfirmationPanel final : public wxPanel
{
public:
    using ConfirmedHandler = std::function<void(domain::GameAction)>;
    using VisibilityChangedHandler = std::function<void(bool)>;

    explicit GameActionConfirmationPanel(wxWindow* parent);

    void SetConfirmedHandler(ConfirmedHandler handler);
    void SetVisibilityChangedHandler(VisibilityChangedHandler handler);
    void ShowConfirmation(domain::GameAction action);
    void HideConfirmation();
    [[nodiscard]] bool IsActive() const;
    [[nodiscard]] bool HandleKey(wxKeyEvent& event);
    [[nodiscard]] std::vector<wxWindow*> TabTargets() const;

private:
    void Confirm();
    void Cancel();
    void CycleFocus(bool backwards);

    wxStaticText* title_ = nullptr;
    wxStaticText* message_ = nullptr;
    wxButton* cancelButton_ = nullptr;
    wxButton* confirmButton_ = nullptr;
    std::optional<domain::GameAction> action_;
    wxWeakRef<wxWindow> previousFocus_;
    ConfirmedHandler onConfirmed_;
    VisibilityChangedHandler onVisibilityChanged_;
};
}
