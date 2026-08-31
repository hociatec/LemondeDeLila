#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/checklst.h>
#include <wx/choice.h>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/rearrangectrl.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/ModalNavigation.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::prompt
{
GamePromptPanel::GamePromptPanel(wxWindow* parent)
    : wxPanel(parent, wxID_ANY)
{
    BuildLayout();
    Hide();
}

void GamePromptPanel::SetSubmitHandler(SubmitHandler handler) { onSubmit_ = std::move(handler); }
void GamePromptPanel::SetCancelHandler(CancelHandler handler) { onCancel_ = std::move(handler); }
void GamePromptPanel::SetValidationErrorHandler(ValidationErrorHandler handler)
{
    onValidationError_ = std::move(handler);
}
void GamePromptPanel::SetVisibilityChangedHandler(VisibilityChangedHandler handler)
{
    onVisibilityChanged_ = std::move(handler);
}
void GamePromptPanel::SetCandidatesRequestHandler(CandidatesRequestHandler handler)
{
    onCandidatesRequest_ = std::move(handler);
}

void GamePromptPanel::BuildLayout()
{
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* root = new wxBoxSizer(wxVERTICAL);
    title_ = new wxStaticText(this, wxID_ANY, wxString(L"Configuration"));
    title_->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    title_->SetFont(lila::shared::ui::Theme::TitleFont());
    root->Add(title_, 0, wxEXPAND | wxBOTTOM, 10);

    fieldsSizer_ = new wxBoxSizer(wxVERTICAL);
    root->Add(fieldsSizer_, 1, wxEXPAND);

    candidatesLabel_ = new wxStaticText(this, wxID_ANY, wxString(L"Candidats disponibles"));
    candidatesLabel_->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    root->Add(candidatesLabel_, 0, wxEXPAND | wxTOP | wxBOTTOM, 4);
    auto* candidateSearch = new wxBoxSizer(wxHORIZONTAL);
    candidatesQuery_ = new wxTextCtrl(this, wxID_ANY);
    candidatesQuery_->SetName(wxString(L"Recherche de candidats"));
    candidatesSearchButton_ = new wxButton(this, wxID_FIND, wxString(L"Rechercher"));
    candidateSearch->Add(candidatesQuery_, 1, wxRIGHT, 6);
    candidateSearch->Add(candidatesSearchButton_);
    root->Add(candidateSearch, 0, wxEXPAND | wxBOTTOM, 4);
    candidatesList_ = new wxListBox(this, wxID_ANY);
    candidatesList_->SetName(wxString(L"Candidats de l'action"));
    root->Add(candidatesList_, 1, wxEXPAND | wxBOTTOM, 4);
    candidatesMoreButton_ = new wxButton(this, wxID_MORE, wxString(L"Charger la suite"));
    root->Add(candidatesMoreButton_, 0, wxALIGN_LEFT | wxBOTTOM, 8);

    auto* buttons = new wxBoxSizer(wxHORIZONTAL);
    buttons->AddStretchSpacer();
    cancelButton_ = new wxButton(this, wxID_CANCEL, wxString(L"Annuler"));
    submitButton_ = new wxButton(this, wxID_OK, wxString(L"Valider"));
    buttons->Add(cancelButton_, 0, wxRIGHT, 8);
    buttons->Add(submitButton_);
    root->Add(buttons, 0, wxEXPAND | wxTOP, 12);
    SetSizer(root);

    cancelButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { Cancel(); });
    submitButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { Submit(); });
    candidatesSearchButton_->Bind(wxEVT_BUTTON,
        [this](wxCommandEvent&) { RequestCandidates(true); });
    candidatesMoreButton_->Bind(wxEVT_BUTTON,
        [this](wxCommandEvent&) { RequestCandidates(false); });
}

void GamePromptPanel::Cancel()
{
    const auto cancelAction = cancelActionType_;
    HidePrompt();
    if (onCancel_) onCancel_(cancelAction);
}

void GamePromptPanel::HidePrompt(bool clearSignature)
{
    Hide();
    action_.reset();
    cancelActionType_.clear();
    if (clearSignature) signature_.clear();
    candidatesRequestPending_ = false;
    if (onVisibilityChanged_) onVisibilityChanged_(false);
}

bool GamePromptPanel::IsActive() const { return IsShown(); }

std::vector<wxWindow*> GamePromptPanel::TabTargets() const
{
    std::vector<wxWindow*> controls;
    controls.reserve(fields_.size() + 2);
    if (paginatedCandidates_)
    {
        controls.push_back(candidatesQuery_);
        controls.push_back(candidatesSearchButton_);
        controls.push_back(candidatesList_);
        if (candidatesMoreButton_->IsShown()) controls.push_back(candidatesMoreButton_);
    }
    for (const auto& field : fields_)
        controls.push_back(field.ordering != nullptr ? static_cast<wxWindow*>(field.ordering)
            : field.multipleChoice != nullptr ? static_cast<wxWindow*>(field.multipleChoice)
            : field.choice != nullptr ? static_cast<wxWindow*>(field.choice)
            : field.checkbox != nullptr ? static_cast<wxWindow*>(field.checkbox)
                                        : static_cast<wxWindow*>(field.text));
    controls.push_back(cancelButton_);
    controls.push_back(submitButton_);
    return controls;
}

void GamePromptPanel::FocusFirst()
{
    for (auto* control : TabTargets())
        if (lila::shared::accessibility::NavigationController::Focus(control)) return;
}

bool GamePromptPanel::HandleKey(wxKeyEvent& event)
{
    return lila::shared::accessibility::HandleModalKey(
        event,
        IsActive(),
        TabTargets(),
        [this] { Cancel(); },
        [this] { Submit(); });
}
}
