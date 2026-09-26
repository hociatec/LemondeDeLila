#include "shared/ui/presentation/controls/VerticalMenu.h"

#include <chrono>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/window.h>

#include "shared/accessibility/application/NavigationController.h"
#include "shared/logging/application/Logger.h"
#include "shared/ui/presentation/controls/VerticalMenuEntry.h"

namespace lila::shared::ui::controls
{
void VerticalMenu::BindListEvents()
{
    if (listBox_ == nullptr)
    {
        return;
    }

    listBox_->Bind(
        wxEVT_SET_FOCUS,
        [](wxFocusEvent& event)
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
    // Some native Windows list controls don't emit wxEVT_CHAR_HOOK for
    // Ctrl+Home/Ctrl+End. Keep the direct key event as a fallback.
    listBox_->Bind(
        wxEVT_KEY_DOWN,
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
        NotifyNavigationFeedback();
    }
}

void VerticalMenu::OnListActivated(std::size_t index)
{
    selectedIndex_ = index;
    UpdateVisualSelection();
    NotifySelectionChanged();
    NotifyActivationFeedback();
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
        event.Skip();
        return;
    }
    if (FocusBoundaryFromKey(event) || FocusByInitialFromKey(event, selectedIndex_))
    {
        event.Skip(false);
        return;
    }

    switch (key)
    {
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
    case WXK_SPACE:
    case WXK_NUMPAD_SPACE:
        // Espace sert uniquement à lire/naviguer. Il ne doit jamais ouvrir
        // un élément de menu ou de liste.
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
    listBox_->SetSelection(static_cast<int>(index));
    listBox_->SetFocus();
    UpdateVisualSelection();
    if (notify)
    {
        NotifySelectionChanged();
        if (changed)
        {
            NotifyNavigationFeedback();
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

void VerticalMenu::NotifyNavigationFeedback()
{
    wxCommandEvent event(wxEVT_LILA_MENU_NAVIGATED, GetId());
    event.SetEventObject(this);
    ProcessWindowEvent(event);
}

void VerticalMenu::NotifyActivationFeedback()
{
    wxCommandEvent event(wxEVT_LILA_MENU_ACTIVATED, GetId());
    event.SetEventObject(this);
    ProcessWindowEvent(event);
}

void VerticalMenu::UpdateVisualSelection()
{
    listBox_->Refresh();
}
}
