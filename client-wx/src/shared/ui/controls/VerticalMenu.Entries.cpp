#include "shared/ui/controls/VerticalMenu.h"

#include <algorithm>

#include <wx/event.h>
#include <wx/sizer.h>

#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenuEntry.h"

namespace lila::shared::ui::controls
{
void VerticalMenu::BuildEntryLayout(std::span<const VerticalMenuItem> items)
{
    SetEntryItems(items);
}

void VerticalMenu::SetItemsForNavigation(
    std::span<const VerticalMenuItem> items,
    std::size_t selectedIndex)
{
    if (role_ != VerticalMenuRole::Entries)
    {
        SetItems(items);
        if (!items.empty()) SetSelectedIndexSilently(std::min(selectedIndex, items.size() - 1));
        return;
    }

    VerticalMenuEntry* focusedEntry = nullptr;
    for (auto* entry : entries_)
    {
        if (entry->HasFocus())
        {
            focusedEntry = entry;
            break;
        }
    }

    while (entries_.size() < items.size())
    {
        auto* entry = new VerticalMenuEntry(this, wxString{});
        BindEntry(*entry);
        sizer_->Add(entry, 0, wxEXPAND | wxBOTTOM, 6);
        entries_.push_back(entry);
    }

    const auto target = items.empty() ? 0 : std::min(selectedIndex, items.size() - 1);
    if (focusedEntry != nullptr && !items.empty())
    {
        const auto current = std::find(entries_.begin(), entries_.end(), focusedEntry);
        if (current != entries_.end() && static_cast<std::size_t>(std::distance(entries_.begin(), current)) != target)
        {
            entries_.erase(current);
            entries_.insert(entries_.begin() + static_cast<std::ptrdiff_t>(target), focusedEntry);
            sizer_->Detach(focusedEntry);
            sizer_->Insert(target, focusedEntry, 0, wxEXPAND | wxBOTTOM, 6);
        }
    }

    while (entries_.size() > items.size())
    {
        auto* entry = entries_.back();
        sizer_->Detach(entry);
        entry->Destroy();
        entries_.pop_back();
    }

    itemIds_.clear();
    itemIds_.reserve(items.size());
    for (std::size_t index = 0; index < items.size(); ++index)
    {
        if (entries_[index]->GetLabel() != items[index].label)
            entries_[index]->SetLabel(items[index].label);
        if (entries_[index]->GetName() != items[index].label)
            entries_[index]->SetName(items[index].label);
        itemIds_.push_back(items[index].id);
    }
    itemCount_ = items.size();
    selectedIndex_ = target;
    ApplyTheme();
    Layout();
}

void VerticalMenu::SetEntryItems(std::span<const VerticalMenuItem> items)
{
    bool unchanged = items.size() == entries_.size() && items.size() == itemIds_.size();
    for (std::size_t index = 0; unchanged && index < items.size(); ++index)
    {
        unchanged = itemIds_[index] == items[index].id &&
            entries_[index]->GetLabel() == items[index].label;
    }
    if (unchanged)
    {
        return;
    }

    const auto retainedCount = std::min(entries_.size(), items.size());
    for (std::size_t index = 0; index < retainedCount; ++index)
    {
        if (entries_[index]->GetLabel() != items[index].label)
            entries_[index]->SetLabel(items[index].label);
        if (entries_[index]->GetName() != items[index].label)
            entries_[index]->SetName(items[index].label);
    }

    while (entries_.size() > items.size())
    {
        auto* entry = entries_.back();
        sizer_->Detach(entry);
        entry->Destroy();
        entries_.pop_back();
    }

    entries_.reserve(items.size());
    for (std::size_t index = entries_.size(); index < items.size(); ++index)
    {
        const auto& item = items[index];
        auto* entry = new VerticalMenuEntry(this, item.label);
        BindEntry(*entry);
        sizer_->Add(entry, 0, wxEXPAND | wxBOTTOM, 6);
        entries_.push_back(entry);
    }

    itemIds_.clear();
    itemIds_.reserve(items.size());
    for (const auto& item : items) itemIds_.push_back(item.id);
    itemCount_ = items.size();
    selectedIndex_ = itemCount_ == 0 ? 0 : std::min(selectedIndex_, itemCount_ - 1);
    ApplyTheme();
    Layout();
}

void VerticalMenu::BindEntry(VerticalMenuEntry& entry)
{
    entry.Bind(
        wxEVT_BUTTON,
        [this, entryPtr = &entry](wxCommandEvent&)
        {
            const auto found = std::find(entries_.begin(), entries_.end(), entryPtr);
            if (found == entries_.end()) return;
            const auto index = static_cast<std::size_t>(std::distance(entries_.begin(), found));
            OnListActivated(index);
        });
    entry.Bind(
        wxEVT_CHAR_HOOK,
        [this, entryPtr = &entry](wxKeyEvent& event)
        {
            const auto found = std::find(entries_.begin(), entries_.end(), entryPtr);
            if (found == entries_.end())
            {
                event.Skip();
                return;
            }
            const auto index = static_cast<std::size_t>(std::distance(entries_.begin(), found));
            OnEntryKeyDown(index, event);
        });
}

void VerticalMenu::OnEntryKeyDown(std::size_t index, wxKeyEvent& event)
{
    using Navigator = lila::shared::accessibility::NavigationController;
    const int key = event.GetKeyCode();
    if (onKey_ && onKey_(key))
    {
        event.Skip(false);
        return;
    }
    if (Navigator::IsTabKey(key))
    {
        if (tabNavigationEnabled_ && Navigator::HandleDirectedTab(event, backwardTabTarget_, forwardTabTarget_))
        {
            return;
        }
        event.Skip(false);
        return;
    }

    switch (key)
    {
    case WXK_LEFT:
    case WXK_RIGHT:
    case WXK_NUMPAD_LEFT:
    case WXK_NUMPAD_RIGHT:
        event.Skip(false);
        return;
    case WXK_UP:
    case WXK_NUMPAD_UP:
        if (index > 0)
        {
            FocusIndex(index - 1);
        }
        event.Skip(false);
        return;
    case WXK_DOWN:
    case WXK_NUMPAD_DOWN:
        if (index + 1 < entries_.size())
        {
            FocusIndex(index + 1);
        }
        event.Skip(false);
        return;
    case WXK_RETURN:
    case WXK_NUMPAD_ENTER:
    case WXK_SPACE:
    case WXK_NUMPAD_SPACE:
        entries_[index]->Activate();
        event.Skip(false);
        return;
    default:
        event.Skip();
        return;
    }
}
}
