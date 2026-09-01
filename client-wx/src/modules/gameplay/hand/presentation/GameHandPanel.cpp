#include "modules/gameplay/hand/presentation/GameHandPanel.h"

#include <algorithm>

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/cards/application/GameCardTextBuilder.h"
#include "modules/gameplay/cards/application/GameCardActionResolver.h"
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

void GameHandPanel::ApplyCards(
    const std::vector<domain::GameCard>& cards,
    const std::vector<domain::GameAction>& actions)
{
    const int previousSelection = list_->GetSelection();
    std::vector<std::string> nextKeys;
    std::vector<std::string> nextLabels;
    std::vector<bool> nextActionable;
    nextKeys.reserve(cards.size());
    nextLabels.reserve(cards.size());
    nextActionable.reserve(cards.size());
    for (std::size_t index = 0; index < cards.size(); ++index)
    {
        const auto& card = cards[index];
        nextKeys.push_back(card.id);
        nextLabels.push_back(application::cards::GameCardTextBuilder::AccessibleText(card));
        nextActionable.push_back(
            application::cards::GameCardActionResolver::Resolve(
                cards, actions, index).has_value());
    }
    if (nextKeys == cardKeys_ && nextLabels == cardLabels_)
    {
        // A turn change commonly changes only which cards are actionable.
        // Rebuilding a focused wxListBox would make screen readers announce
        // the selected card again even though its visible content is stable.
        cardActionable_ = std::move(nextActionable);
        return;
    }

    const bool appendOnly = nextKeys.size() > cardKeys_.size() &&
        std::equal(cardKeys_.begin(), cardKeys_.end(), nextKeys.begin()) &&
        std::equal(cardLabels_.begin(), cardLabels_.end(), nextLabels.begin());
    if (appendOnly)
    {
        const auto previousSize = cardLabels_.size();
        cardKeys_ = std::move(nextKeys);
        cardLabels_ = std::move(nextLabels);
        cardActionable_ = std::move(nextActionable);
        for (std::size_t index = previousSize; index < cardLabels_.size(); ++index)
            list_->Append(FromUtf8(cardLabels_[index]));
        Show(true);
        // Keep the existing selection untouched: selecting it again causes
        // NVDA to repeat the focused card after the draw announcement.
        if (previousSelection < 0) list_->SetSelection(0);
        return;
    }

    std::vector<std::size_t> removedIndexes;
    std::size_t previousIndex = 0;
    std::size_t nextIndex = 0;
    while (previousIndex < cardKeys_.size() && nextIndex < nextKeys.size())
    {
        if (cardKeys_[previousIndex] == nextKeys[nextIndex] &&
            cardLabels_[previousIndex] == nextLabels[nextIndex])
        {
            ++previousIndex;
            ++nextIndex;
        }
        else
        {
            removedIndexes.push_back(previousIndex++);
        }
    }
    while (previousIndex < cardKeys_.size())
        removedIndexes.push_back(previousIndex++);
    const bool removalOnly = nextKeys.size() < cardKeys_.size() &&
        nextIndex == nextKeys.size() &&
        removedIndexes.size() == cardKeys_.size() - nextKeys.size();
    if (removalOnly)
    {
        int preservedSelection = previousSelection;
        if (previousSelection >= 0)
            preservedSelection -= static_cast<int>(std::count_if(
                removedIndexes.begin(), removedIndexes.end(),
                [previousSelection](std::size_t index)
                {
                    return index < static_cast<std::size_t>(previousSelection);
                }));
        for (auto index = removedIndexes.rbegin(); index != removedIndexes.rend(); ++index)
            list_->Delete(static_cast<unsigned int>(*index));
        cardKeys_ = std::move(nextKeys);
        cardLabels_ = std::move(nextLabels);
        cardActionable_ = std::move(nextActionable);
        if (list_->GetCount() == 0)
        {
            Hide();
            return;
        }
        preservedSelection = std::clamp(
            preservedSelection, 0, static_cast<int>(list_->GetCount()) - 1);
        if (list_->GetSelection() != preservedSelection)
            list_->SetSelection(preservedSelection);
        return;
    }

    list_->Clear();
    cardKeys_ = std::move(nextKeys);
    cardLabels_ = std::move(nextLabels);
    cardActionable_ = std::move(nextActionable);
    for (const auto& label : cardLabels_) list_->Append(FromUtf8(label));

    const bool hasHand = list_->GetCount() > 0;
    Show(hasHand);
    if (!hasHand) return;

    // A state refresh must not move the reader through the hand. Keep the
    // current position even when the selected card disappeared; gameplay
    // announcements already describe the change.
    const int nextSelection = previousSelection < 0
        ? 0 : std::min(previousSelection, static_cast<int>(list_->GetCount()) - 1);
    list_->SetSelection(nextSelection);
}

void GameHandPanel::ClearHand()
{
    cardKeys_.clear();
    cardLabels_.clear();
    cardActionable_.clear();
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
