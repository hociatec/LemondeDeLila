#include "modules/gameplay/presentation/prompt/GamePromptPanel.h"

#include <algorithm>
#include <cctype>
#include <sstream>
#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/event.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/application/GamePromptInputCodec.h"
#include "modules/gameplay/presentation/GamePlayFormatters.h"
#include "shared/accessibility/application/NavigationController.h"
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
    cancelButton_ = new wxButton(this, wxID_CANCEL, wxString(L"Annuler (Échap)"));
    submitButton_ = new wxButton(this, wxID_OK, wxString(L"Valider (Entrée)"));
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
        signature << '|' << field.key << ':' << field.kind << ':' << field.initialText;
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
        if (kind == "boolean" || kind == "bool")
        {
            control.checkbox = new wxCheckBox(this, wxID_ANY, FromUtf8(field.label));
            const auto parsed = application::GamePromptInputCodec::Parse(field, field.initialText);
            control.checkbox->SetValue(
                parsed.valid && parsed.value.is_boolean() && parsed.value.get<bool>());
            control.checkbox->SetName(FromUtf8(field.label));
            fieldsSizer_->Add(control.checkbox, 0, wxEXPAND | wxBOTTOM, 8);
        }
        else
        {
            auto* label = new wxStaticText(this, wxID_ANY, FromUtf8(field.label));
            label->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
            fieldsSizer_->Add(label, 0, wxEXPAND | wxBOTTOM, 3);
            control.text = new wxTextCtrl(this, wxID_ANY, FromUtf8(field.initialText),
                wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER | wxWANTS_CHARS);
            control.text->SetName(FromUtf8(field.label));
            fieldsSizer_->Add(control.text, 0, wxEXPAND | wxBOTTOM, 8);
        }
        fields_.push_back(std::move(control));
    }
}

void GamePromptPanel::Submit()
{
    if (!IsActive() || !action_) return;
    auto action = *action_;
    for (const auto& control : fields_)
    {
        const std::string raw = control.checkbox != nullptr
            ? (control.checkbox->GetValue() ? "oui" : "non")
            : std::string(control.text->GetValue().ToUTF8().data());
        auto parsed = application::GamePromptInputCodec::Parse(control.field, raw);
        if (!parsed.valid)
        {
            auto* target = control.checkbox != nullptr
                ? static_cast<wxWindow*>(control.checkbox)
                : static_cast<wxWindow*>(control.text);
            if (onValidationError_)
                onValidationError_(FromUtf8(control.field.label + " : " + parsed.error), target);
            lila::shared::accessibility::NavigationController::Focus(target);
            return;
        }
        action.payload[control.field.key] = std::move(parsed.value);
    }
    HidePrompt();
    if (onSubmit_) onSubmit_(std::move(action));
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
        controls.push_back(field.checkbox != nullptr ? static_cast<wxWindow*>(field.checkbox)
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

void GamePromptPanel::CycleFocus(bool backwards)
{
    const auto controls = TabTargets();
    if (controls.empty()) return;
    const auto current = std::find(controls.begin(), controls.end(), wxWindow::FindFocus());
    std::size_t index = current == controls.end()
        ? (backwards ? controls.size() - 1 : 0)
        : static_cast<std::size_t>(std::distance(controls.begin(), current));
    if (current != controls.end())
        index = backwards ? (index == 0 ? controls.size() - 1 : index - 1)
                          : (index + 1) % controls.size();
    lila::shared::accessibility::NavigationController::Focus(controls[index]);
}

bool GamePromptPanel::HandleKey(wxKeyEvent& event)
{
    if (!IsActive()) return false;
    const int key = event.GetKeyCode();
    if (key == WXK_TAB || key == WXK_NUMPAD_TAB)
    {
        CycleFocus(event.ShiftDown());
        return true;
    }
    if (key == WXK_ESCAPE)
    {
        Cancel();
        return true;
    }
    if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
    {
        Submit();
        return true;
    }
    return false;
}
}
