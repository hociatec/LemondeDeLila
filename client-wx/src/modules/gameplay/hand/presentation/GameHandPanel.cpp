#include "modules/gameplay/hand/presentation/GameHandPanel.h"

#include <algorithm>

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/cards/application/GameCardTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/ui/presentation/controls/ListBoxNavigation.h"
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
    for (const auto& card : cards)
        list_->Append(FromUtf8(application::cards::GameCardTextBuilder::AccessibleText(card)));

    const bool hasHand = list_->GetCount() > 0;
    Show(hasHand);
    if (!hasHand) return;

    const auto firstEnabled = std::find_if(
        cards.begin(), cards.end(),
        [](const domain::GameCard& card) { return !card.disabled; });
    const int defaultSelection = firstEnabled == cards.end()
        ? 0
        : static_cast<int>(std::distance(cards.begin(), firstEnabled));
    const int nextSelection = previousSelection != wxNOT_FOUND && previousSelection >= 0 &&
        static_cast<unsigned int>(previousSelection) < list_->GetCount()
        ? previousSelection
        : defaultSelection;
    list_->SetSelection(nextSelection);
}

void GameHandPanel::ClearHand()
{
    list_->Clear();
    Hide();
}

bool GameHandPanel::MoveSelection(bool backwards)
{
    return lila::shared::ui::controls::list_box::MoveSelection(*list_, backwards);
}

int GameHandPanel::SelectedIndex() const noexcept { return list_->GetSelection(); }

wxWindow* GameHandPanel::NavigationTarget() const noexcept
{
    return lila::shared::ui::controls::list_box::NavigationTarget(
        *this, *list_);
}

}
