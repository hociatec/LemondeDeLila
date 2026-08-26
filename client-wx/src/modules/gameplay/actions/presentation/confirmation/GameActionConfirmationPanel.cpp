#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"

#include <utility>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/ModalNavigation.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::confirmation
{
GameActionConfirmationPanel::GameActionConfirmationPanel(wxWindow* parent)
    : wxPanel(parent, wxID_ANY)
{
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* root = new wxBoxSizer(wxVERTICAL);
    title_ = new wxStaticText(this, wxID_ANY, wxString(L"Confirmation"));
    title_->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    title_->SetFont(lila::shared::ui::Theme::TitleFont());
    root->Add(title_, 0, wxEXPAND | wxBOTTOM, 10);

    message_ = new wxStaticText(this, wxID_ANY, wxString(L"Confirmer cette action ?"));
    message_->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    message_->Wrap(560);
    root->Add(message_, 1, wxEXPAND | wxBOTTOM, 12);

    auto* buttons = new wxBoxSizer(wxHORIZONTAL);
    buttons->AddStretchSpacer();
    cancelButton_ = new wxButton(this, wxID_CANCEL, wxString(L"Non"));
    confirmButton_ = new wxButton(this, wxID_OK, wxString(L"Oui"));
    buttons->Add(cancelButton_, 0, wxRIGHT, 8);
    buttons->Add(confirmButton_);
    root->Add(buttons, 0, wxEXPAND);
    SetSizer(root);
    Hide();

    cancelButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { Cancel(); });
    confirmButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { Confirm(); });
}

void GameActionConfirmationPanel::SetConfirmedHandler(ConfirmedHandler handler)
{
    onConfirmed_ = std::move(handler);
}

void GameActionConfirmationPanel::SetVisibilityChangedHandler(VisibilityChangedHandler handler)
{
    onVisibilityChanged_ = std::move(handler);
}

void GameActionConfirmationPanel::ShowConfirmation(domain::GameAction action)
{
    previousFocus_ = wxWindow::FindFocus();
    action_ = std::move(action);
    const auto label = action_->label.empty() ? action_->type : action_->label;
    title_->SetLabel(FromUtf8(label.empty() ? std::string("Confirmation") : label));
    message_->SetLabel(wxString(L"Confirmer cette action ?"));
    Show();
    if (onVisibilityChanged_) onVisibilityChanged_(true);
    Layout();
    lila::shared::accessibility::NavigationController::Focus(confirmButton_);
}

void GameActionConfirmationPanel::HideConfirmation()
{
    Hide();
    action_.reset();
    if (onVisibilityChanged_) onVisibilityChanged_(false);
    if (previousFocus_)
        lila::shared::accessibility::NavigationController::Focus(previousFocus_.get());
    previousFocus_ = nullptr;
}

bool GameActionConfirmationPanel::IsActive() const { return IsShown(); }

std::vector<wxWindow*> GameActionConfirmationPanel::TabTargets() const
{
    return {cancelButton_, confirmButton_};
}

void GameActionConfirmationPanel::Confirm()
{
    if (!action_) return;
    auto action = *action_;
    action.confirm = false;
    HideConfirmation();
    if (onConfirmed_) onConfirmed_(std::move(action));
}

void GameActionConfirmationPanel::Cancel()
{
    HideConfirmation();
}

bool GameActionConfirmationPanel::HandleKey(wxKeyEvent& event)
{
    return lila::shared::accessibility::HandleModalKey(
        event,
        IsActive(),
        TabTargets(),
        [this] { Cancel(); },
        [this] { Confirm(); });
}
}
