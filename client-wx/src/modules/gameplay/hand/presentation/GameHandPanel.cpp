#include "modules/gameplay/hand/presentation/GameHandPanel.h"

#include <algorithm>
#include <cctype>
#include <numeric>
#include <type_traits>
#include <utility>

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/cards/application/GameCardTextBuilder.h"
#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/accessibility/presentation/AccessibleMenu.h"
#include "shared/ui/presentation/controls/ListBoxNavigation.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::hand
{
namespace
{
bool IsNumber(const std::string& value)
{
    return !value.empty() && std::all_of(value.begin(), value.end(),
        [](unsigned char character) { return std::isdigit(character) != 0; });
}

bool IsBefore(const std::string& left, const std::string& right)
{
    if (left.size() != right.size()) return left.size() < right.size();
    return left < right;
}

void SortCards(
    std::vector<std::string>& keys,
    std::vector<std::string>& labels,
    std::vector<bool>& actionable,
    bool ascending)
{
    std::vector<std::size_t> order(labels.size());
    std::iota(order.begin(), order.end(), 0);
    std::stable_sort(order.begin(), order.end(), [&labels, ascending](std::size_t left, std::size_t right)
    {
        const bool leftNumber = IsNumber(labels[left]);
        const bool rightNumber = IsNumber(labels[right]);
        if (leftNumber != rightNumber) return ascending ? leftNumber : !leftNumber;
        const bool before = leftNumber ? IsBefore(labels[left], labels[right])
                                       : labels[left] < labels[right];
        const bool after = leftNumber ? IsBefore(labels[right], labels[left])
                                      : labels[left] > labels[right];
        return ascending ? before : after;
    });
    const auto reorder = [&order](auto& values)
    {
        using Value = typename std::decay_t<decltype(values)>::value_type;
        std::vector<Value> sorted;
        sorted.reserve(values.size());
        for (const auto index : order) sorted.push_back(values[index]);
        values = std::move(sorted);
    };
    reorder(keys); reorder(labels); reorder(actionable);
}
}

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
    lila::shared::accessibility::ConfigureListBoxAsAccessibleList(
        *list_, wxString(L"Votre main"), {});
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
    if (sortAscending_) SortCards(nextKeys, nextLabels, nextActionable, *sortAscending_);
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
    sortAscending_.reset();
    list_->Clear();
    Hide();
}

bool GameHandPanel::Sort(bool ascending)
{
    if (cardLabels_.empty()) return false;
    const auto selectedKey = SelectedCardKey();
    sortAscending_ = ascending;
    SortCards(cardKeys_, cardLabels_, cardActionable_, ascending);
    list_->Clear();
    for (const auto& label : cardLabels_) list_->Append(FromUtf8(label));
    const auto selected = std::find(cardKeys_.begin(), cardKeys_.end(), selectedKey);
    list_->SetSelection(selected == cardKeys_.end()
        ? 0 : static_cast<int>(selected - cardKeys_.begin()));
    return true;
}

bool GameHandPanel::MoveSelection(bool backwards)
{
    return lila::shared::ui::controls::list_box::MoveSelection(*list_, backwards);
}

int GameHandPanel::SelectedIndex() const noexcept { return list_->GetSelection(); }

std::string GameHandPanel::SelectedCardKey() const
{
    const int selection = SelectedIndex();
    return selection < 0 || static_cast<std::size_t>(selection) >= cardKeys_.size()
        ? std::string{} : cardKeys_[static_cast<std::size_t>(selection)];
}

wxWindow* GameHandPanel::NavigationTarget() const noexcept
{
    return lila::shared::ui::controls::list_box::NavigationTarget(
        *this, *list_);
}

}
