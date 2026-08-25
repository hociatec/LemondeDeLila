#include "modules/gameplay/dice/presentation/GameDicePanel.h"

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/dice/application/GameDiceTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
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
    list_->Clear();
    if (!state)
    {
        Hide();
        return;
    }
    for (const auto& die : state->dice)
        list_->Append(FromUtf8(application::dice::GameDiceTextBuilder::DieText(die)));
    if (state->dice.empty())
        list_->Append(FromUtf8(application::dice::GameDiceTextBuilder::TotalText(*state)));

    const bool visible = list_->GetCount() > 0;
    Show(visible);
    if (!visible) return;
    const int selection = previous >= 0 &&
        static_cast<unsigned int>(previous) < list_->GetCount() ? previous : 0;
    list_->SetSelection(selection);
}

void GameDicePanel::Clear()
{
    list_->Clear();
    Hide();
}

bool GameDicePanel::MoveSelection(bool backwards)
{
    const auto count = list_->GetCount();
    if (count == 0) return false;
    int selected = list_->GetSelection();
    if (selected == wxNOT_FOUND) selected = backwards ? static_cast<int>(count) - 1 : 0;
    else if (backwards && selected > 0) --selected;
    else if (!backwards && static_cast<unsigned int>(selected + 1) < count) ++selected;
    list_->SetSelection(selected);
    return true;
}

int GameDicePanel::SelectedIndex() const noexcept { return list_->GetSelection(); }

wxString GameDicePanel::SelectedLabel() const
{
    const int selected = list_->GetSelection();
    return selected == wxNOT_FOUND ? wxString{} : list_->GetString(selected);
}
}
