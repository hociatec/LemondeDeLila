#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

#include <cctype>
#include <sstream>
#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/checklst.h>
#include <wx/choice.h>
#include <wx/event.h>
#include <wx/sizer.h>
#include <wx/rearrangectrl.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
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
}

std::string GamePromptPanel::BuildSignature(const domain::GamePrompt& prompt)
{
    std::ostringstream signature;
    signature << prompt.actionType;
    for (const auto& field : prompt.fields)
        signature << '|' << field.key << ':' << field.kind << ':' << field.initialText
                  << ':' << field.multiple << ':' << field.ordering;
    for (const auto& field : prompt.fields)
        for (const auto& choice : field.choices)
            signature << ':' << infrastructure::EncodeGameValue(choice).dump();
    return signature.str();
}

void GamePromptPanel::ShowPrompt(const domain::GamePrompt& prompt, domain::GameAction action)
{
    action_ = std::move(action);
    cancelActionType_ = prompt.cancelActionType;
    const auto nextSignature = BuildSignature(prompt);
    if (signature_ != nextSignature)
    {
        signature_ = nextSignature;
        RebuildFields(prompt);
    }

    const auto title = prompt.title.empty() ? prompt.label : prompt.title;
    title_->SetLabel(FromUtf8(title.empty() ? std::string("Configuration") : title));
    Show();
    if (onVisibilityChanged_) onVisibilityChanged_(true);
    Layout();
    FocusFirst();
}

void GamePromptPanel::RebuildFields(const domain::GamePrompt& prompt)
{
    fieldsSizer_->Clear(true);
    fields_.clear();
    for (const auto& field : prompt.fields)
    {
        FieldControl control;
        control.field = field;
        std::string kind = field.kind;
        std::transform(kind.begin(), kind.end(), kind.begin(),
            [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
        if (!field.choices.empty())
        {
            auto* label = new wxStaticText(this, wxID_ANY, FromUtf8(field.label));
            label->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
            fieldsSizer_->Add(label, 0, wxEXPAND | wxBOTTOM, 3);
            wxArrayString labels;
            for (const auto& choice : field.choices)
            {
                const auto encoded = infrastructure::EncodeGameValue(choice);
                labels.Add(FromUtf8(encoded.is_string()
                    ? encoded.get<std::string>() : encoded.dump()));
            }
            if (field.ordering)
            {
                wxArrayInt order;
                for (std::size_t index = 0; index < field.choices.size(); ++index)
                    order.Add(static_cast<int>(index));
                control.ordering = new wxRearrangeCtrl(this, wxID_ANY,
                    wxDefaultPosition, wxDefaultSize, order, labels);
                control.ordering->SetName(FromUtf8(field.label +
                    ". Réorganisez avec les boutons haut et bas."));
                fieldsSizer_->Add(control.ordering, 0, wxEXPAND | wxBOTTOM, 8);
            }
            else if (field.multiple)
            {
                control.multipleChoice = new wxCheckListBox(this, wxID_ANY,
                    wxDefaultPosition, wxDefaultSize, labels);
                control.multipleChoice->SetName(FromUtf8(field.label + ". Choix multiples."));
                fieldsSizer_->Add(control.multipleChoice, 0, wxEXPAND | wxBOTTOM, 8);
            }
            else
            {
                if (field.optional) labels.Insert(wxString(L"Non renseigné"), 0);
                control.choice = new wxChoice(this, wxID_ANY,
                    wxDefaultPosition, wxDefaultSize, labels);
                control.choice->SetSelection(0);
                control.choice->SetName(FromUtf8(field.label));
                fieldsSizer_->Add(control.choice, 0, wxEXPAND | wxBOTTOM, 8);
            }
        }
        else if (kind == "boolean" || kind == "bool")
        {
            if (field.optional)
            {
                control.field.choices = {domain::GameValue{true}, domain::GameValue{false}};
                control.choice = new wxChoice(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
                    wxArrayString{wxString(L"Non renseigné"), wxString(L"Oui"), wxString(L"Non")});
                control.choice->SetSelection(0);
                control.choice->SetName(FromUtf8(field.label));
                fieldsSizer_->Add(control.choice, 0, wxEXPAND | wxBOTTOM, 8);
            }
            else
            {
                control.checkbox = new wxCheckBox(this, wxID_ANY, FromUtf8(field.label));
                const auto parsed = application::GamePromptInputCodec::Parse(field, field.initialText);
                control.checkbox->SetValue(
                    parsed.valid && parsed.value.is_boolean() && parsed.value.get<bool>());
                control.checkbox->SetName(FromUtf8(field.label));
                fieldsSizer_->Add(control.checkbox, 0, wxEXPAND | wxBOTTOM, 8);
            }
        }
        else
        {
            auto* label = new wxStaticText(this, wxID_ANY, FromUtf8(field.label));
            label->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
            fieldsSizer_->Add(label, 0, wxEXPAND | wxBOTTOM, 3);
            const long style = wxTE_PROCESS_ENTER | wxWANTS_CHARS |
                ((kind == "array" || kind == "object" || kind == "json") ? wxTE_MULTILINE : 0);
            control.text = new wxTextCtrl(this, wxID_ANY, FromUtf8(field.initialText),
                wxDefaultPosition, wxDefaultSize, style);
            control.text->SetName(FromUtf8(field.label));
            fieldsSizer_->Add(control.text, 0, wxEXPAND | wxBOTTOM, 8);
        }
        fields_.push_back(std::move(control));
    }
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
    if (onVisibilityChanged_) onVisibilityChanged_(false);
}

bool GamePromptPanel::IsActive() const { return IsShown(); }

std::vector<wxWindow*> GamePromptPanel::TabTargets() const
{
    std::vector<wxWindow*> controls;
    controls.reserve(fields_.size() + 2);
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
