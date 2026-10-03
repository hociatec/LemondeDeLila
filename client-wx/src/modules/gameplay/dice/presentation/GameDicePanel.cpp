#include "modules/gameplay/dice/presentation/GameDicePanel.h"

#include <utility>

#include <wx/button.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/dice/application/GameDiceActionResolver.h"
#include "modules/gameplay/dice/application/GameDiceTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::dice
{
GameDicePanel::GameDicePanel(wxWindow* parent) : wxPanel(parent)
{
    auto* layout = new wxBoxSizer(wxVERTICAL);
    rollButton_ = new wxButton(this, wxID_ANY, wxString(L"Lancer les dés"));
    rollButton_->SetName(wxString(L"Lancer les dés"));
    resultLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    resultLabel_->SetName(wxString(L"Résultat des dés"));
    layout->Add(rollButton_, 0, wxEXPAND | wxBOTTOM, 4);
    layout->Add(resultLabel_, 0, wxEXPAND);
    SetSizer(layout);
    rollButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&)
    {
        if (action_ && onActivate_) onActivate_(*action_);
    });
    Hide();
}

void GameDicePanel::Apply(
    const domain::GameDiceState* dice,
    const std::vector<domain::GameAction>& actions)
{
    if (dice == nullptr)
    {
        Clear();
        return;
    }
    action_ = application::dice::GameDiceActionResolver::Resolve(*dice, actions);
    const auto buttonLabel = action_ && !action_->label.empty()
        ? action_->label : std::string("Lancer les dés");
    rollButton_->SetLabel(FromUtf8(buttonLabel));
    rollButton_->SetName(FromUtf8(buttonLabel));
    rollButton_->Show(action_.has_value());
    rollButton_->Enable(action_.has_value());

    std::string result = application::dice::GameDiceTextBuilder::TotalText(*dice);
    for (const auto& die : dice->dice)
    {
        const auto text = application::dice::GameDiceTextBuilder::DieText(die);
        if (text.empty()) continue;
        if (!result.empty()) result += "\n";
        result += text;
    }
    resultLabel_->SetLabel(FromUtf8(result));
    resultLabel_->Show(!result.empty());
    Show(action_.has_value() || !result.empty());
    Layout();
}

void GameDicePanel::Clear()
{
    action_.reset();
    resultLabel_->SetLabel(wxString{});
    rollButton_->Hide();
    resultLabel_->Hide();
    Hide();
}

void GameDicePanel::SetActivateHandler(ActivateHandler handler)
{
    onActivate_ = std::move(handler);
}

wxWindow* GameDicePanel::NavigationTarget() const
{
    return IsShown() && rollButton_->IsShown() && rollButton_->IsEnabled()
        ? rollButton_ : nullptr;
}

std::optional<domain::GameAction> GameDicePanel::ResolveAction() const
{
    return action_;
}
}
