#include "modules/gameplay/dice/presentation/GameDicePanel.h"

#include <algorithm>

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/dice/application/GameDiceTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/ui/presentation/controls/ListBoxNavigation.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::dice
{
GameDicePanel::GameDicePanel(wxWindow* parent)
    : wxPanel(parent, wxID_ANY)
{
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* root = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(this, wxID_ANY, wxString(L"Dés"));
    title->SetForegroundColour(lila::shared::ui::Theme::Accent());
    root->Add(title, 0, wxEXPAND | wxBOTTOM, 4);
    list_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize, 0, nullptr,
        wxLB_SINGLE | wxWANTS_CHARS);
    list_->SetName(wxString(L"Dés"));
    list_->SetMinSize(wxSize(260, 60));
    root->Add(list_, 1, wxEXPAND);
    SetSizer(root);
    Hide();
}

void GameDicePanel::Apply(const std::optional<domain::GameDiceState>& state)
{
    const int previous = list_->GetSelection();
    const auto previousKey = previous >= 0 && static_cast<std::size_t>(previous) < rowKeys_.size()
        ? rowKeys_[static_cast<std::size_t>(previous)] : std::string{};
    std::vector<std::string> nextKeys;
    std::vector<std::string> nextLabels;
    if (state)
    {
        for (const auto& die : state->dice)
        {
            nextKeys.push_back(die.id);
            nextLabels.push_back(application::dice::GameDiceTextBuilder::DieText(die));
        }
        if (state->dice.empty())
        {
            nextKeys.push_back("total");
            nextLabels.push_back(application::dice::GameDiceTextBuilder::TotalText(*state));
        }
    }
    if (nextKeys == rowKeys_ && nextLabels == rowLabels_) return;
    list_->Clear();
    rowKeys_ = std::move(nextKeys);
    rowLabels_ = std::move(nextLabels);
    for (const auto& label : rowLabels_) list_->Append(FromUtf8(label));

    const bool visible = list_->GetCount() > 0;
    Show(visible);
    if (!visible) return;
    const auto matchingRow = std::find(rowKeys_.begin(), rowKeys_.end(), previousKey);
    const int selection = matchingRow == rowKeys_.end() ? 0
        : static_cast<int>(std::distance(rowKeys_.begin(), matchingRow));
    list_->SetSelection(selection);
}

void GameDicePanel::Clear()
{
    rowKeys_.clear();
    rowLabels_.clear();
    list_->Clear();
    Hide();
}

bool GameDicePanel::MoveSelection(bool backwards)
{
    return lila::shared::ui::controls::list_box::MoveSelection(*list_, backwards);
}

int GameDicePanel::SelectedIndex() const noexcept { return list_->GetSelection(); }

wxWindow* GameDicePanel::NavigationTarget() const noexcept
{
    return lila::shared::ui::controls::list_box::NavigationTarget(
        *this, *list_);
}
}
