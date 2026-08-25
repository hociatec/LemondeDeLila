#include "modules/gameplay/hand/presentation/GameHandPanel.h"

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::hand
{
GameHandPanel::GameHandPanel(wxWindow* parent)
    : wxPanel(parent, wxID_ANY)
{
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* root = new wxBoxSizer(wxVERTICAL);
    auto* label = new wxStaticText(this, wxID_ANY, wxString(L"Main"));
    label->SetForegroundColour(lila::shared::ui::Theme::Accent());
    root->Add(label, 0, wxEXPAND | wxBOTTOM, 4);
    list_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize, 0, nullptr,
        wxLB_SINGLE | wxWANTS_CHARS);
    list_->SetName(wxString(L"Votre main"));
    list_->SetMinSize(wxSize(260, 90));
    root->Add(list_, 1, wxEXPAND);
    SetSizer(root);
    Hide();
}

void GameHandPanel::ApplyCards(const std::vector<domain::GameCard>& cards)
{
    const int previousSelection = list_->GetSelection();
    list_->Clear();
    for (const auto& card : cards) list_->Append(FromUtf8(card.label));

    const bool hasHand = list_->GetCount() > 0;
    Show(hasHand);
    if (!hasHand) return;
    const int nextSelection = previousSelection != wxNOT_FOUND && previousSelection >= 0 &&
        static_cast<unsigned int>(previousSelection) < list_->GetCount()
        ? previousSelection
        : 0;
    list_->SetSelection(nextSelection);
}

void GameHandPanel::ClearHand()
{
    list_->Clear();
    Hide();
}

bool GameHandPanel::MoveSelection(bool backwards)
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

int GameHandPanel::SelectedIndex() const noexcept { return list_->GetSelection(); }

std::size_t GameHandPanel::Count() const noexcept
{
    return static_cast<std::size_t>(list_->GetCount());
}

wxString GameHandPanel::SelectedLabel() const
{
    const int selected = list_->GetSelection();
    return selected == wxNOT_FOUND ? wxString{} : list_->GetString(selected);
}

}
