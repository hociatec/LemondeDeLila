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
    const auto previousKey = previousSelection >= 0 &&
        static_cast<std::size_t>(previousSelection) < cardKeys_.size()
        ? cardKeys_[static_cast<std::size_t>(previousSelection)] : std::string{};
    std::vector<std::string> nextKeys;
    std::vector<std::string> nextLabels;
    nextKeys.reserve(cards.size());
    nextLabels.reserve(cards.size());
    for (const auto& card : cards)
    {
        nextKeys.push_back(card.id);
        nextLabels.push_back(application::cards::GameCardTextBuilder::AccessibleText(card));
    }
    if (nextKeys == cardKeys_ && nextLabels == cardLabels_) return;
    list_->Clear();
    cardKeys_ = std::move(nextKeys);
    cardLabels_ = std::move(nextLabels);
    for (const auto& label : cardLabels_) list_->Append(FromUtf8(label));

    const bool hasHand = list_->GetCount() > 0;
    Show(hasHand);
    if (!hasHand) return;

    const auto firstEnabled = std::find_if(
        cards.begin(), cards.end(),
        [](const domain::GameCard& card) { return !card.disabled; });
    const int defaultSelection = firstEnabled == cards.end()
        ? 0
        : static_cast<int>(std::distance(cards.begin(), firstEnabled));
    const auto matchingCard = std::find(cardKeys_.begin(), cardKeys_.end(), previousKey);
    const int nextSelection = matchingCard == cardKeys_.end() ? defaultSelection
        : static_cast<int>(std::distance(cardKeys_.begin(), matchingCard));
    list_->SetSelection(nextSelection);
}

void GameHandPanel::ClearHand()
{
    cardKeys_.clear();
    cardLabels_.clear();
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
