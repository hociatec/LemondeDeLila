#include "shared/ui/controls/VerticalMenu.h"

#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"

#include <chrono>
#include <stdexcept>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/window.h>

#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenuEntry.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/accessibility/AccessibleMenu.h"
#include "shared/logging/Logger.h"
#include "shared/audio/AudioService.h"

namespace lila::shared::ui::controls
{
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

    if (selectedIndex_ == index &&
        listBox_ != nullptr &&
        listBox_->GetSelection() == static_cast<int>(index))
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
    if (itemCount_ > 0)
    {
        selectedIndex_ = 0;
    }
    else
    {
        selectedIndex_ = 0;
    }

    UpdateVisualSelection();
}

void VerticalMenu::FocusSelectedItem()
{
    if (itemCount_ == 0)
    {
        return;
    }

    FocusIndex(selectedIndex_);
}

void VerticalMenu::FocusFirstItem()
{
    if (itemCount_ == 0)
    {
        return;
    }

    FocusIndex(0);
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

void VerticalMenu::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::PanelBackground());
    if (listBox_ != nullptr)
    {
        listBox_->SetFont(Theme::BodyFont());
        listBox_->SetForegroundColour(Theme::TextPrimary());
        listBox_->SetBackgroundColour(Theme::PanelBackground());
    }
    for (auto* entry : entries_)
    {
        entry->ApplyTheme();
    }
}

void VerticalMenu::BuildLayout(std::span<const VerticalMenuItem> items)
{
    sizer_ = new wxBoxSizer(wxVERTICAL);
    if (role_ == VerticalMenuRole::Entries)
    {
        SetSizer(sizer_);
        BuildEntryLayout(items);
        return;
    }

    listBox_ = new wxListBox(
        this,
        wxID_ANY,
        wxDefaultPosition,
        wxDefaultSize,
        0,
        nullptr,
        wxLB_SINGLE | wxBORDER_NONE);
    const auto onActivated = [this](std::size_t index)
    {
        OnListActivated(index);
    };
    switch (role_)
    {
    case VerticalMenuRole::Menu:
        lila::shared::accessibility::ConfigureListBoxAsAccessibleMenu(
            *listBox_,
            wxEmptyString,
            onActivated);
        break;
    case VerticalMenuRole::List:
        lila::shared::accessibility::ConfigureListBoxAsAccessibleList(
            *listBox_,
            wxEmptyString,
            onActivated);
        break;
    case VerticalMenuRole::Entries:
        break;
    }
    itemIds_.clear();
    itemIds_.reserve(items.size());
    for (const auto& item : items)
    {
        if (listBox_ != nullptr)
        {
            listBox_->Append(item.label);
        }
        itemIds_.push_back(item.id);
    }
    itemCount_ = items.size();
    if (itemCount_ > 0)
    {
        selectedIndex_ = 0;
    }

    if (listBox_ != nullptr)
    {
        sizer_->Add(listBox_, 1, wxEXPAND);
    }

    SetSizer(sizer_);
    BindListEvents();
    if (itemCount_ > 0)
    {
        listBox_->SetSelection(0);
    }
}

void VerticalMenu::BindListEvents()
{
    if (listBox_ == nullptr)
    {
        return;
    }

    listBox_->Bind(
        wxEVT_SET_FOCUS,
        [this](wxFocusEvent& event)
        {
            event.Skip();
        });
    listBox_->Bind(
        wxEVT_LISTBOX,
        [this](wxCommandEvent& event)
        {
            OnListSelectionChanged(event);
        });
    listBox_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&)
        {
            if (selectedIndex_ >= itemCount_)
            {
                return;
            }

            const auto now = std::chrono::steady_clock::now();
            if (lastPointerActivatedIndex_.has_value() &&
                *lastPointerActivatedIndex_ == selectedIndex_ &&
                now - lastPointerActivationAt_ <= std::chrono::milliseconds(350))
            {
                return;
            }

            lastPointerActivatedIndex_ = std::nullopt;
            lastPointerActivationAt_ = {};
            OnListActivated(selectedIndex_);
        });
    listBox_->Bind(
        wxEVT_LEFT_UP,
        [this](wxMouseEvent& event)
        {
            if (selectedIndex_ < itemCount_)
            {
                lastPointerActivatedIndex_ = selectedIndex_;
                lastPointerActivationAt_ = std::chrono::steady_clock::now();
                OnListActivated(selectedIndex_);
            }
            event.Skip();
        });
    listBox_->Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            OnListKeyDown(event);
        });
}

void VerticalMenu::OnListSelectionChanged(wxCommandEvent& event)
{
    const int selected = event.GetInt();
    if (selected < 0 || static_cast<std::size_t>(selected) >= itemCount_)
    {
        return;
    }

    const auto nextIndex = static_cast<std::size_t>(selected);
    const bool changed = selectedIndex_ != nextIndex;
    selectedIndex_ = nextIndex;
    UpdateVisualSelection();
    NotifySelectionChanged();
    if (changed)
    {
        lila::shared::audio::AudioService::PlayGlobal(lila::shared::audio::SoundCue::Navigation);
    }
}

void VerticalMenu::OnListActivated(std::size_t index)
{
    selectedIndex_ = index;
    UpdateVisualSelection();
    NotifySelectionChanged();
    lila::shared::audio::AudioService::PlayGlobal(lila::shared::audio::SoundCue::Selection);
    if (onActivated_)
    {
        onActivated_(index);
    }
}

void VerticalMenu::OnListKeyDown(wxKeyEvent& event)
{
    if (listBox_ == nullptr)
    {
        event.Skip();
        return;
    }

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
        if (itemCount_ > 0 && selectedIndex_ > 0)
        {
            FocusIndex(selectedIndex_ - 1);
        }
        event.Skip(false);
        return;
    case WXK_DOWN:
    case WXK_NUMPAD_DOWN:
        if (itemCount_ > 0 && selectedIndex_ + 1 < itemCount_)
        {
            FocusIndex(selectedIndex_ + 1);
        }
        event.Skip(false);
        return;
    case WXK_RETURN:
    case WXK_NUMPAD_ENTER:
        if (selectedIndex_ < itemCount_)
        {
            OnListActivated(selectedIndex_);
        }
        event.Skip(false);
        return;
    default:
        event.Skip();
        return;
    }
}

void VerticalMenu::FocusIndex(std::size_t index, bool notify)
{
    if (index >= itemCount_)
    {
        lila::shared::logging::LogWarning("VerticalMenu", "FocusIndex: invalid index.");
        return;
    }

    const bool changed = selectedIndex_ != index;
    selectedIndex_ = index;
    if (role_ == VerticalMenuRole::Entries)
    {
        if (index >= entries_.size() || entries_[index] == nullptr)
        {
            return;
        }
        entries_[index]->SetFocus();
    }
    else
    {
        if (listBox_ == nullptr)
        {
            return;
        }
        listBox_->SetSelection(static_cast<int>(index));
        listBox_->SetFocus();
    }
    UpdateVisualSelection();
    if (notify)
    {
        NotifySelectionChanged();
        if (changed)
        {
            lila::shared::audio::AudioService::PlayGlobal(lila::shared::audio::SoundCue::Navigation);
        }
    }
}

void VerticalMenu::NotifySelectionChanged()
{
    if (onSelectionChanged_)
    {
        onSelectionChanged_(selectedIndex_);
    }
}

void VerticalMenu::UpdateVisualSelection()
{
    if (role_ == VerticalMenuRole::Entries)
    {
        for (auto* entry : entries_)
        {
            entry->Refresh();
        }
        return;
    }

    if (listBox_ != nullptr)
    {
        listBox_->Refresh();
    }
}
}
