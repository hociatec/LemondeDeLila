#include "shared/ui/presentation/controls/VerticalMenu.h"

#include <stdexcept>
#include <algorithm>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/window.h>

#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/ui/presentation/controls/VerticalMenuEntry.h"

namespace lila::shared::ui::controls
{
wxDEFINE_EVENT(wxEVT_LILA_MENU_NAVIGATED, wxCommandEvent);
wxDEFINE_EVENT(wxEVT_LILA_MENU_ACTIVATED, wxCommandEvent);

VerticalMenu::VerticalMenu(wxWindow* parent, std::span<const VerticalMenuItem> items, VerticalMenuRole role)
    : wxPanel(parent, wxID_ANY),
      role_(role)
{
    BuildLayout(items);
    ApplyTheme();
}

VerticalMenu::~VerticalMenu() = default;

void VerticalMenu::SetSelectionChangedHandler(SelectionChangedHandler handler)
{
    onSelectionChanged_ = std::move(handler);
}

void VerticalMenu::SetActivatedHandler(ActivatedHandler handler)
{
    onActivated_ = std::move(handler);
}

void VerticalMenu::SetKeyHandler(KeyHandler handler)
{
    onKey_ = std::move(handler);
}

void VerticalMenu::SetSelectedIndexSilently(std::size_t index)
{
    if (itemCount_ == 0)
    {
        selectedIndex_ = 0;
        return;
    }

    if (index >= itemCount_)
    {
        throw std::out_of_range(lila::shared::text::ui::VerticalMenuIndexOutOfRange.str());
    }

    if (selectedIndex_ == index && listBox_->GetSelection() == static_cast<int>(index))
    {
        return;
    }

    selectedIndex_ = index;
    listBox_->SetSelection(static_cast<int>(index));
    UpdateVisualSelection();
}

void VerticalMenu::SetItems(std::span<const VerticalMenuItem> items)
{
    ReplaceItems(items, std::nullopt);
}

void VerticalMenu::ReplaceItems(
    std::span<const VerticalMenuItem> items, std::optional<std::size_t> selection)
{
    if (listBox_ == nullptr)
    {
        return;
    }

    bool unchanged = items.size() == itemCount_ && items.size() == itemIds_.size();
    for (std::size_t index = 0; unchanged && index < items.size(); ++index)
    {
        unchanged = itemIds_[index] == items[index].id &&
            listBox_->GetString(static_cast<unsigned int>(index)) == items[index].label;
    }
    if (unchanged)
    {
        if (selection && !items.empty())
            SetSelectedIndexSilently(std::min(*selection, items.size() - 1));
        return;
    }

    const auto targetIndex = items.empty() ? 0 : std::min(selection.value_or(0), items.size() - 1);
    const int previousSelection = listBox_->GetSelection();

    // A native list announces LB_SETCURSEL even before it owns keyboard focus.
    // When a visible empty menu is populated for the first time, that selection
    // announcement is immediately followed by the real focus announcement.
    // Prepare the initial selection while the native control is hidden from the
    // accessibility tree, then expose the fully initialized list once.
    const bool prepareInitialSelectionHidden =
        itemCount_ == 0 && !items.empty() && listBox_->IsShownOnScreen() &&
        !listBox_->HasFocus();
    if (prepareInitialSelectionHidden) listBox_->Hide();

    // Treat the native list rows as stable presentation slots. Clearing and
    // rebuilding a focused wxListBox makes Windows emit a new selection event,
    // so screen readers announce the unchanged focused item a second time.
    // Update labels in place and resize only at the tail instead.
    const auto retainedCount = std::min<std::size_t>(
        listBox_->GetCount(), items.size());
    // SetString restores selection for the row it replaces. Defer the old
    // selected label until the destination (including newly appended rows)
    // exists and is selected, so Windows never announces the old selection.
    const bool deferPreviousLabel = previousSelection != wxNOT_FOUND &&
        static_cast<std::size_t>(previousSelection) < retainedCount &&
        static_cast<std::size_t>(previousSelection) != targetIndex;
    for (std::size_t index = 0; index < retainedCount; ++index)
    {
        if (deferPreviousLabel && index == static_cast<std::size_t>(previousSelection)) continue;
        if (listBox_->GetString(static_cast<unsigned int>(index)) != items[index].label)
            listBox_->SetString(static_cast<unsigned int>(index), items[index].label);
    }
    while (listBox_->GetCount() > items.size())
        listBox_->Delete(listBox_->GetCount() - 1);
    for (std::size_t index = retainedCount; index < items.size(); ++index)
        listBox_->Append(items[index].label);

    itemIds_.clear();
    itemIds_.reserve(items.size());
    for (const auto& item : items) itemIds_.push_back(item.id);

    itemCount_ = items.size();
    selectedIndex_ = targetIndex;
    if (itemCount_ > 0)
    {
        // Preserve the native selection when the logical target did not move.
        // Reapplying it produces a redundant accessibility announcement.
        if (listBox_->GetSelection() != static_cast<int>(selectedIndex_))
            listBox_->SetSelection(static_cast<int>(selectedIndex_));
    }
    if (deferPreviousLabel &&
        listBox_->GetString(previousSelection) != items[previousSelection].label)
        listBox_->SetString(previousSelection, items[previousSelection].label);
    if (prepareInitialSelectionHidden) listBox_->Show();
    UpdateVisualSelection();
}

std::size_t VerticalMenu::GetSelectedIndex() const
{
    return selectedIndex_;
}

std::size_t VerticalMenu::GetItemCount() const
{
    return itemCount_;
}

std::string_view VerticalMenu::GetItemId(std::size_t index) const
{
    if (index >= itemIds_.size())
    {
        throw std::out_of_range(lila::shared::text::ui::VerticalMenuIndexOutOfRange.str());
    }

    return itemIds_[index];
}

std::optional<std::string_view> VerticalMenu::GetSelectedItemId() const
{
    if (selectedIndex_ >= itemIds_.size())
    {
        return std::nullopt;
    }

    return itemIds_[selectedIndex_];
}

wxWindow* VerticalMenu::GetSelectedControl() const
{
    return listBox_;
}

wxWindow* VerticalMenu::GetFirstButton() const
{
    return entries_.empty() ? static_cast<wxWindow*>(listBox_) : entries_.front();
}

void VerticalMenu::SetAccessibleName(const wxString& name)
{
    // Only the focused list carries the name; its containing panel is silent.
    SetName(wxEmptyString);
    if (listBox_ != nullptr) listBox_->SetName(name);
}

}
