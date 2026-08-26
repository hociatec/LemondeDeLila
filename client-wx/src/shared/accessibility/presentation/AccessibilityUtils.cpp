#include "shared/accessibility/presentation/AccessibilityUtils.h"

#include <wx/string.h>
#include <wx/window.h>

#ifdef __WXMSW__
#include <windows.h>
#endif

namespace lila::shared::accessibility
{
#ifdef __WXMSW__
// EVENT_OBJECT_LIVEREGIONCHANGED (Windows 8+) n'est pas déclaré par les
// anciens en-têtes MinGW lorsque la compatibilité Windows 7 est conservée.
constexpr DWORD LiveRegionChangedEvent = 0x8019;
#endif

void AccessibilityUtils::ConfigureLinearTabOrder(std::initializer_list<wxWindow*> controls)
{
    wxWindow* previous = nullptr;
    for (wxWindow* control : controls)
    {
        if (control == nullptr)
        {
            continue;
        }

        if (previous != nullptr)
        {
            if (control->GetParent() == previous->GetParent())
            {
                control->MoveAfterInTabOrder(previous);
            }
        }

        previous = control;
    }
}

void AccessibilityUtils::SetSecondaryActionAvailability(wxWindow* control, bool available)
{
    if (control == nullptr)
    {
        return;
    }

    control->Show(available);
    control->Enable(available);
}

void AccessibilityUtils::SetAccessibleStatus(wxWindow& control, const wxString& message)
{
    if (message.empty())
    {
        SetAccessibleName(control, wxString(L"État"), wxString(L"État"));
        return;
    }

    SetAccessibleName(control, message, wxString(L"État : ") + message);
}

void AccessibilityUtils::AnnounceStatus(wxWindow& control, const wxString& message)
{
    SetAccessibleStatus(control, message);
#ifdef __WXMSW__
    if (control.GetHandle() != nullptr)
    {
        NotifyWinEvent(
            LiveRegionChangedEvent,
            reinterpret_cast<HWND>(control.GetHandle()),
            OBJID_CLIENT,
            CHILDID_SELF);
    }
#endif
}

void AccessibilityUtils::AnnounceLiveRegion(wxWindow& control, const wxString& message)
{
    control.SetLabel(message);
    // The native text is already the accessible name. Do not duplicate it in
    // wxWindow::Name or HelpText, otherwise NVDA can read the line twice.
    control.SetName(wxString{});
    control.SetHelpText(wxString{});
#ifdef __WXMSW__
    if (control.GetHandle() != nullptr)
    {
        NotifyWinEvent(
            LiveRegionChangedEvent,
            reinterpret_cast<HWND>(control.GetHandle()),
            OBJID_CLIENT,
            CHILDID_SELF);
    }
#endif
}

void AccessibilityUtils::SetAccessibleName(wxWindow& control, const wxString& name, const wxString& description)
{
    control.SetName(name);
    control.SetHelpText(description);
}
}
