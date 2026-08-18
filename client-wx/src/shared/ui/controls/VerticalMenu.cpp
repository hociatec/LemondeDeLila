#include "shared/ui/controls/VerticalMenu.h"

#include "shared/errors/ErrorMessages.h"

#include <stdexcept>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/window.h>

#include "shared/ui/Theme.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/accessibility/AccessibleMenu.h"

namespace lila::shared::ui::controls
{
VerticalMenu::VerticalMenu(wxWindow* parent, std::span<const VerticalMenuItem> items)
    : wxPanel(parent, wxID_ANY)
{
    BuildLayout(items);
    ApplyTheme();
}

void VerticalMenu::SetSelectionChangedHandler(SelectionChangedHandler handler)
{
    onSelectionChanged_ = std::move(handler);
}

void VerticalMenu::SetActivatedHandler(ActivatedHandler handler)
{
    onActivated_ = std::move(handler);
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
        throw std::out_of_range(lila::shared::errors::VerticalMenuIndexOutOfRange);
    }

    FocusIndex(index);
}

void VerticalMenu::SetItems(std::span<const VerticalMenuItem> items)
{
    if (listBox_ == nullptr)
    {
        return;
    }

    listBox_->Clear();
    for (const auto& item : items)
    {
        listBox_->Append(item.label);
    }

    itemCount_ = items.size();
    if (itemCount_ > 0)
    {
        selectedIndex_ = 0;
        listBox_->SetSelection(static_cast<int>(selectedIndex_));
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

wxWindow* VerticalMenu::GetFirstButton() const
{
    return listBox_;
}

wxWindow* VerticalMenu::GetLastButton() const
{
    return listBox_;
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
}

void VerticalMenu::BuildLayout(std::span<const VerticalMenuItem> items)
{
    sizer_ = new wxBoxSizer(wxVERTICAL);
    listBox_ = new wxListBox(
        this,
        wxID_ANY,
        wxDefaultPosition,
        wxDefaultSize,
        0,
        nullptr,
        wxLB_SINGLE | wxBORDER_NONE);
    lila::shared::accessibility::ConfigureListBoxAsAccessibleMenu(
        *listBox_,
        wxString(L"Menu"),
        [this](std::size_t index)
        {
            OnListActivated(index);
        });
    for (const auto& item : items)
    {
        if (listBox_ != nullptr)
        {
            listBox_->Append(item.label);
        }
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
            if (!GetName().empty())
            {
                listBox_->SetName(GetName());
            }
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
            if (selectedIndex_ < itemCount_)
            {
                OnListActivated(selectedIndex_);
            }
        });
    listBox_->Bind(
        wxEVT_KEY_DOWN,
        [this](wxKeyEvent& event)
        {
            OnListKeyDown(event);
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
    if (listBox_ != nullptr && !GetName().empty())
    {
        listBox_->SetName(GetName());
    }
    const int selected = event.GetInt();
    if (selected < 0 || static_cast<std::size_t>(selected) >= itemCount_)
    {
        return;
    }

    selectedIndex_ = static_cast<std::size_t>(selected);
    UpdateVisualSelection();
    NotifySelectionChanged();
}

void VerticalMenu::OnListActivated(std::size_t index)
{
    selectedIndex_ = index;
    UpdateVisualSelection();
    NotifySelectionChanged();
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
    if (tabNavigationEnabled_ && Navigator::HandleDirectedTab(event, backwardTabTarget_, forwardTabTarget_))
    {
        return;
    }

    const int key = event.GetKeyCode();
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
    default:
        event.Skip();
        return;
    }
}

void VerticalMenu::FocusIndex(std::size_t index)
{
    if (index >= itemCount_ || listBox_ == nullptr)
    {
        return;
    }

    selectedIndex_ = index;
    listBox_->SetSelection(static_cast<int>(index));
    if (!GetName().empty())
    {
        listBox_->SetName(GetName());
    }
    listBox_->SetFocus();
    UpdateVisualSelection();
    NotifySelectionChanged();
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
    if (listBox_ == nullptr)
    {
        return;
    }

    listBox_->Refresh();
}
}

