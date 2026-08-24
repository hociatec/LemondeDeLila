#include "shared/ui/presentation/controls/VerticalMenu.h"

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/window.h>

#include "shared/accessibility/presentation/AccessibleMenu.h"
#include "shared/ui/presentation/controls/VerticalMenuEntry.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::shared::ui::controls
{
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
        listBox_->Append(item.label);
        itemIds_.push_back(item.id);
    }
    itemCount_ = items.size();
    selectedIndex_ = 0;

    sizer_->Add(listBox_, 1, wxEXPAND);
    SetSizer(sizer_);
    BindListEvents();
    if (itemCount_ > 0)
    {
        listBox_->SetSelection(0);
    }
}
}
