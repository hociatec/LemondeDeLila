#include "shared/accessibility/presentation/AccessibleMenu.h"

#include <utility>

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

    const int selection = list->GetSelection();
    *childId = selection == wxNOT_FOUND ? wxACC_SELF : selection + 1;
    return wxACC_OK;
}

wxAccStatus AccessibleListBox::DoDefaultAction(int childId)
{
    wxListBox* list = List();
    if (list == nullptr || !IsValidChild(childId))
    {
        return childId == wxACC_SELF ? wxACC_NOT_SUPPORTED : wxACC_INVALID_ARG;
    }

    const int itemIndex = childId - 1;
    list->SetSelection(itemIndex);
    list->SetFocus();
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
    if ((selectFlags & wxACC_SEL_TAKESELECTION) != 0 ||
        (selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
    {
        list->SetSelection(itemIndex);
    }
    if ((selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
    {
        list->SetFocus();
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
    if (roleMode_ == RoleMode::List)
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
#else
    static_cast<void>(onActivated);
#endif
}
}
