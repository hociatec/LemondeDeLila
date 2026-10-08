#include "shared/accessibility/presentation/AccessibleMenu.h"
#include "shared/accessibility/presentation/NavigationController.h"
#include "shared/accessibility/presentation/AccessibleListEvents.h"

#include <utility>
#ifdef __WXMSW__
#include <windows.h>
#endif

namespace lila::shared::accessibility
{
#if wxUSE_ACCESSIBILITY
wxAccStatus AccessibleListBox::GetFocus(int* childId, wxAccessible** child)
{
    if (childId == nullptr || child == nullptr)
    {
        return wxACC_INVALID_ARG;
    }

    *child = nullptr;
    wxListBox* list = List();
    if (list == nullptr || !list->HasFocus())
    {
        *childId = 0;
        return wxACC_OK;
    }

    const int focused = FocusedItem();
    *childId = wxACC_SELF;
    if (focused == wxNOT_FOUND)
    {
        *child = this;
        return wxACC_OK;
    }
    // Return the actual accessible object, not a simple child ID. Otherwise
    // NVDA redirects the container's native focus event to the row and then
    // announces the row again when its own native focus event arrives.
    return GetChild(focused + 1, child);
}

int AccessibleListBox::FocusedItem() const
{
    const auto* list = List();
    if (list == nullptr || !list->HasFocus() || list->GetCount() == 0)
        return wxNOT_FOUND;
    if (!list->HasMultipleSelection()) return list->GetSelection();
#ifdef __WXMSW__
    // The caret, not the last selected row, owns focus in an extended list.
    const auto caret = static_cast<int>(SendMessage(
        reinterpret_cast<HWND>(list->GetHandle()), LB_GETCARETINDEX, 0, 0));
    return caret >= 0 && static_cast<unsigned int>(caret) < list->GetCount()
        ? caret : wxNOT_FOUND;
#else
    wxArrayInt selections;
    list->GetSelections(selections);
    return selections.IsEmpty() ? wxNOT_FOUND : selections.Last();
#endif
}

wxAccStatus AccessibleListBox::DoDefaultAction(int childId)
{
    wxListBox* list = List();
    if (list == nullptr || !IsValidChild(childId))
    {
        return childId == wxACC_SELF ? wxACC_NOT_SUPPORTED : wxACC_INVALID_ARG;
    }

    const int itemIndex = childId - 1;
    if (!list->IsSelected(itemIndex)) list->SetSelection(itemIndex);
    static_cast<void>(NavigationController::Focus(list));
    if (onActivated_)
    {
        onActivated_(static_cast<std::size_t>(itemIndex));
    }
    return wxACC_OK;
}

wxAccStatus AccessibleListBox::Select(int childId, wxAccSelectionFlags selectFlags)
{
    wxListBox* list = List();
    if (list == nullptr || !IsValidChild(childId))
    {
        return wxACC_INVALID_ARG;
    }

    const int itemIndex = childId - 1;
    if ((selectFlags & wxACC_SEL_REMOVESELECTION) != 0)
    {
        list->Deselect(itemIndex);
    }
    else if ((selectFlags & wxACC_SEL_TAKESELECTION) != 0 ||
             (selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
    {
        if (list->HasMultipleSelection()) list->DeselectAll(itemIndex);
        if (!list->IsSelected(itemIndex)) list->SetSelection(itemIndex);
    }
    else if ((selectFlags & wxACC_SEL_ADDSELECTION) != 0 ||
             (selectFlags & wxACC_SEL_EXTENDSELECTION) != 0)
    {
        if (!list->IsSelected(itemIndex)) list->SetSelection(itemIndex, true);
    }
    if ((selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
    {
#ifdef __WXMSW__
        if (list->HasMultipleSelection())
            SendMessage(reinterpret_cast<HWND>(list->GetHandle()),
                LB_SETCARETINDEX, static_cast<WPARAM>(itemIndex), FALSE);
#endif
        static_cast<void>(NavigationController::Focus(list));
    }
    return wxACC_OK;
}

wxAccStatus AccessibleListBox::GetDefaultAction(int childId, wxString* actionName)
{
    if (actionName == nullptr)
    {
        return wxACC_INVALID_ARG;
    }
    if (!IsValidChild(childId))
    {
        return childId == wxACC_SELF ? wxACC_NOT_SUPPORTED : wxACC_INVALID_ARG;
    }
    if (roleMode_ == RoleMode::List && !onActivated_)
    {
        return wxACC_NOT_SUPPORTED;
    }

    *actionName = wxString(L"Ouvrir");
    return wxACC_OK;
}

wxListBox* AccessibleListBox::List() const noexcept
{
    return list_.get();
}

bool AccessibleListBox::IsValidChild(int childId) const noexcept
{
    wxListBox* list = List();
    return list != nullptr && childId > 0 && static_cast<unsigned int>(childId) <= list->GetCount();
}
#endif

void ConfigureListBoxAsAccessibleMenu(
    wxListBox& list,
    const wxString& accessibleName,
    AccessibleListActivatedHandler onActivated)
{
    list.SetName(accessibleName);
#if wxUSE_ACCESSIBILITY
    list.SetAccessible(new AccessibleListBox(list, std::move(onActivated), AccessibleListBox::RoleMode::Menu));
#ifdef __WXMSW__
    AccessibleListEvents::Install(list);
#endif
#else
    static_cast<void>(onActivated);
#endif
}

void ConfigureListBoxAsAccessibleList(
    wxListBox& list,
    const wxString& accessibleName,
    AccessibleListActivatedHandler onActivated)
{
    list.SetName(accessibleName);
#if wxUSE_ACCESSIBILITY
    list.SetAccessible(new AccessibleListBox(list, std::move(onActivated), AccessibleListBox::RoleMode::List));
#ifdef __WXMSW__
    AccessibleListEvents::Install(list);
#endif
#else
    static_cast<void>(onActivated);
#endif
}
}
