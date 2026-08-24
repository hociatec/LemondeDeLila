#include "shared/ui/presentation/controls/VerticalMenu.h"

#include <stdexcept>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/window.h>

#include "shared/errors/catalog/ErrorMessages.h"
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

void VerticalMenu::SetSelectedIndex(std::size_t index)
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

    FocusIndex(index);
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

    if (role_ == VerticalMenuRole::Entries)
    {
        selectedIndex_ = index;
        UpdateVisualSelection();
        return;
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
    if (role_ == VerticalMenuRole::Entries)
    {
        SetEntryItems(items);
        return;
    }

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
        return;
    }

    listBox_->Clear();
    itemIds_.clear();
    itemIds_.reserve(items.size());
    for (const auto& item : items)
    {
        listBox_->Append(item.label);
        itemIds_.push_back(item.id);
    }

    itemCount_ = items.size();
    selectedIndex_ = 0;
    if (itemCount_ > 0)
    {
        listBox_->SetSelection(0);
    }
    UpdateVisualSelection();
}

void VerticalMenu::FocusSelectedItem()
{
    if (itemCount_ > 0)
    {
        FocusIndex(selectedIndex_);
    }
}

void VerticalMenu::FocusFirstItem()
{
    if (itemCount_ > 0)
    {
        FocusIndex(0);
    }
}

void VerticalMenu::SetForwardTabTarget(wxWindow* target)
{
    forwardTabTarget_ = target;
}

void VerticalMenu::SetBackwardTabTarget(wxWindow* target)
{
    backwardTabTarget_ = target;
}

void VerticalMenu::SetTabNavigationEnabled(bool enabled)
{
    tabNavigationEnabled_ = enabled;
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
    if (role_ == VerticalMenuRole::Entries)
    {
        return selectedIndex_ < entries_.size() ? entries_[selectedIndex_] : nullptr;
    }

    return listBox_;
}

wxWindow* VerticalMenu::GetFirstButton() const
{
    return entries_.empty() ? static_cast<wxWindow*>(listBox_) : entries_.front();
}

wxWindow* VerticalMenu::GetLastButton() const
{
    return entries_.empty() ? static_cast<wxWindow*>(listBox_) : entries_.back();
}
}
