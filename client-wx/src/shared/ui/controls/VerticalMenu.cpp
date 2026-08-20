#include "shared/ui/controls/VerticalMenu.h"

#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"

#include <chrono>
#include <stdexcept>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/window.h>

#include "shared/ui/Theme.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/accessibility/AccessibleMenu.h"
#include "shared/logging/Logger.h"

namespace lila::shared::ui::controls
{
VerticalMenu::VerticalMenu(wxWindow* parent, std::span<const VerticalMenuItem> items)
    : wxPanel(parent, wxID_ANY)
{
    lila::shared::logging::LogInfo("VerticalMenu", "Constructor: begin.");
    BuildLayout(items);
    lila::shared::logging::LogInfo("VerticalMenu", "Constructor: BuildLayout done.");
    ApplyTheme();
    lila::shared::logging::LogInfo("VerticalMenu", "Constructor: ApplyTheme done.");
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

    FocusIndex(index, false);
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
    lila::shared::logging::LogInfo("VerticalMenu", "BuildLayout: begin.");
    sizer_ = new wxBoxSizer(wxVERTICAL);
    listBox_ = new wxListBox(
        this,
        wxID_ANY,
        wxDefaultPosition,
        wxDefaultSize,
        0,
        nullptr,
        wxLB_SINGLE | wxBORDER_NONE);
    lila::shared::logging::LogInfo("VerticalMenu", "BuildLayout: listBox created.");
    lila::shared::accessibility::ConfigureListBoxAsAccessibleMenu(
        *listBox_,
        wxString(L"Menu"),
        [this](std::size_t index)
        {
            OnListActivated(index);
        });
    lila::shared::logging::LogInfo("VerticalMenu", "BuildLayout: accessible menu configured.");
    for (const auto& item : items)
    {
        if (listBox_ != nullptr)
        {
            listBox_->Append(item.label);
        }
    }
    lila::shared::logging::LogInfo("VerticalMenu", "BuildLayout: items appended.");

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
    lila::shared::logging::LogInfo("VerticalMenu", "BuildLayout: sizer attached.");
    BindListEvents();
    lila::shared::logging::LogInfo("VerticalMenu", "BuildLayout: events bound.");
    if (itemCount_ > 0)
    {
        listBox_->SetSelection(0);
        lila::shared::logging::LogInfo("VerticalMenu", "BuildLayout: initial selection set.");
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

void VerticalMenu::FocusIndex(std::size_t index, bool notify)
{
    lila::shared::logging::LogInfo("VerticalMenu", "FocusIndex: begin.");
    if (index >= itemCount_ || listBox_ == nullptr)
    {
        lila::shared::logging::LogWarning("VerticalMenu", "FocusIndex: invalid index or null listBox.");
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
    if (notify)
    {
        NotifySelectionChanged();
    }
    lila::shared::logging::LogInfo("VerticalMenu", "FocusIndex: end.");
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
