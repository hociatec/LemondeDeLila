#include <cstdlib>
#include <source_location>
#include <vector>
#include <iostream>

#include <wx/app.h>
#include <wx/button.h>
#include <wx/frame.h>
#include <wx/listbox.h>
#include <wx/cshelp.h>
#include <wx/log.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/utils.h>

#include "modules/chat/presentation/ChatEventBinder.h"
#include "shared/accessibility/presentation/ActivationFocusContext.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/AccessibleMenu.h"
#include "shared/accessibility/presentation/NavigationController.h"
#include "shared/ui/presentation/controls/ListBoxNavigation.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

#ifdef __WXMSW__
#include <windows.h>
namespace
{
std::vector<int> selections;
std::vector<bool> selectionVisibilities;
WNDPROC originalListProc = nullptr;
HWND observedWindow = nullptr;
std::vector<DWORD> events;
LRESULT CALLBACK ObserveSelection(HWND window, UINT message, WPARAM wParam, LPARAM lParam)
{
    if (message == LB_SETCURSEL)
    {
        selections.push_back(static_cast<int>(wParam));
        selectionVisibilities.push_back(IsWindowVisible(window) != FALSE);
    }
    return CallWindowProc(originalListProc, window, message, wParam, lParam);
}
void CALLBACK ObserveEvent(HWINEVENTHOOK, DWORD event, HWND window, LONG, LONG, DWORD, DWORD)
{
    if (window == observedWindow) events.push_back(event);
}
void DrainEvents()
{
    // WinEvent callbacks need a native message pump, including outside wxMainLoop.
    for (int iteration = 0; iteration < 20; ++iteration)
    {
        MSG message;
        while (PeekMessage(&message, nullptr, 0, 0, PM_REMOVE))
        {
            TranslateMessage(&message);
            DispatchMessage(&message);
        }
        wxTheApp->ProcessPendingEvents();
        wxMilliSleep(10);
    }
}
}
#endif

void Check(bool condition, std::source_location location = std::source_location::current())
{
    if (condition) return;
    std::cerr << "Accessibility check failed at line " << location.line() << std::endl;
    std::_Exit(EXIT_FAILURE);
}

class AnnouncementTestApp final : public wxApp
{
public:
    bool OnInit() override { return true; }
};
wxIMPLEMENT_APP_NO_MAIN(AnnouncementTestApp);

int main(int argc, char** argv)
{
    using namespace lila::shared::accessibility;
    using namespace lila::shared::ui::controls;
    delete wxLog::SetActiveTarget(new wxLogStderr());
    Check(wxEntryStart(argc, argv));
    Check(wxTheApp->CallOnInit());
    auto* previousHelp = wxHelpProvider::Set(new wxSimpleHelpProvider());
    auto* frame = new wxFrame(nullptr, wxID_ANY, "Accessibility regression tests");
    auto* status = new wxStaticText(frame, wxID_ANY, "Ready");
    auto* text = new wxTextCtrl(frame, wxID_ANY, "Ready", wxDefaultPosition,
        wxDefaultSize, wxTE_READONLY);
    AccessibilityUtils::SetAccessibleStatus(*status, "Ready");
    Check(status->GetName() == "Ready" && status->GetHelpText().empty());
    AccessibilityUtils::SetAccessibleStatus(*text, "Ready");
    Check(text->GetName() != text->GetValue() && text->GetHelpText().empty());
    AccessibilityUtils::SetAccessibleName(*text, "Label", "Label");
    Check(text->GetHelpText().empty());
    AccessibilityUtils::SetAccessibleName(*text, "Label", "Useful instructions");
    Check(text->GetHelpText() == "Useful instructions");
    frame->Show();
    wxYield();

    const std::vector<VerticalMenuItem> items{
        {"first", "Alice"}, {"second", "Bob"}, {"third", "Charlie"}};
    for (const auto role : {VerticalMenuRole::Menu, VerticalMenuRole::List, VerticalMenuRole::Entries})
    {
        auto* menu = new VerticalMenu(frame, items, role);
        menu->SetAccessibleName("Friends");
        auto* list = wxDynamicCast(menu->GetSelectedControl(), wxListBox);
        Check(list != nullptr && menu->GetName().empty() && list->GetName() == "Friends");
#if wxUSE_ACCESSIBILITY
        auto* accessible = list->GetAccessible();
        wxString name, value;
        Check(accessible->GetName(2, &name) == wxACC_OK && name == "Bob");
        Check(accessible->GetValue(2, &value) == wxACC_OK && value.empty());
        Check(accessible->GetValue(wxACC_SELF, &value) == wxACC_OK && value.empty());
        ActivationFocusContext startupContext;
        startupContext.Prepare(list, "Le Monde de Lila - Hacene");
        Check(startupContext.Announcement().StartsWith("Le Monde de Lila - Hacene"));
        Check(accessible->GetName(1, &name) == wxACC_OK &&
            name == wxString(L"Le Monde de Lila - Hacene — Alice"));
        startupContext.ClearIfFocusChanged(list);
        wxYield();
        Check(accessible->GetName(1, &name) == wxACC_OK &&
            name == wxString(L"Le Monde de Lila - Hacene — Alice"));
        startupContext.ClearIfFocusChanged(text);
        Check(accessible->GetName(1, &name) == wxACC_OK && name == "Alice");
#endif
#ifdef __WXMSW__
        originalListProc = reinterpret_cast<WNDPROC>(SetWindowLongPtr(
            reinterpret_cast<HWND>(list->GetHandle()), GWLP_WNDPROC,
            reinterpret_cast<LONG_PTR>(&ObserveSelection)));
        selections.clear();
#endif
        auto updated = items;
        updated[0].label = "Alice (available)";
        menu->SetItemsForNavigation(updated, 2, true);
        Check(menu->GetSelectedIndex() == 2 && list->GetSelection() == 2);
#ifdef __WXMSW__
        Check(selections == std::vector<int>{2});
        selections.clear();
#endif
        menu->SetItemsForNavigation(updated, 2, true);
        Check(lila::shared::ui::controls::list_box::MoveSelection(*list, false));
        updated[0].label = "Alice (busy)";
        menu->SetItemsForNavigation(updated, 2, true);
        Check(list->GetSelection() == 2);
#ifdef __WXMSW__
        Check(selections.empty());
        updated.push_back({"fourth", "Diane"});
        menu->SetItemsForNavigation(updated, 2, true);
        Check(list->GetSelection() == 2);
        Check(selections.empty());
        updated.pop_back();
        menu->SetItemsForNavigation(updated, 2, true);
        Check(list->GetSelection() == 2);
        Check(selections.empty());
        // Updating both labels while navigating must announce only the destination.
        updated[2].label = "Charlie (busy)";
        updated[0].label = "Alice (away)";
        menu->SetItemsForNavigation(updated, 0, true);
        Check(list->GetSelection() == 0 && selections == std::vector<int>{0});
        Check(list->GetString(2) == "Charlie (busy)");
        selections.clear();
        // The destination may not exist until the list has been extended.
        updated[0].label = "Alice (available)";
        updated.push_back({"fourth", "Diane"});
        menu->SetItemsForNavigation(updated, 3, true);
        Check(list->GetSelection() == 3 && selections == std::vector<int>{3});
        Check(list->GetString(0) == "Alice (available)");
        selections.clear();
        updated.resize(2);
        menu->SetItemsForNavigation(updated, 1, true);
        Check(list->GetSelection() == 1 && selections == std::vector<int>{1});
        SetWindowLongPtr(reinterpret_cast<HWND>(list->GetHandle()), GWLP_WNDPROC,
            reinterpret_cast<LONG_PTR>(originalListProc));
#endif
        delete menu;
    }

#ifdef __WXMSW__
    const std::vector<VerticalMenuItem> emptyMenuItems;
    auto* initiallyEmptyMenu = new VerticalMenu(
        frame, emptyMenuItems, VerticalMenuRole::Menu);
    auto* initiallyEmptyList = wxDynamicCast(
        initiallyEmptyMenu->GetSelectedControl(), wxListBox);
    Check(initiallyEmptyList != nullptr && initiallyEmptyList->IsShownOnScreen());
    originalListProc = reinterpret_cast<WNDPROC>(SetWindowLongPtr(
        reinterpret_cast<HWND>(initiallyEmptyList->GetHandle()), GWLP_WNDPROC,
        reinterpret_cast<LONG_PTR>(&ObserveSelection)));
    selections.clear();
    selectionVisibilities.clear();
    const std::vector<VerticalMenuItem> initialReportItems{
        {"new", "Nouveau rapport"}};
    initiallyEmptyMenu->SetItems(initialReportItems);
    Check(selections == std::vector<int>{0});
    Check(selectionVisibilities == std::vector<bool>{false});
    SetWindowLongPtr(reinterpret_cast<HWND>(initiallyEmptyList->GetHandle()),
        GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(originalListProc));
    delete initiallyEmptyMenu;
#endif

    auto* hidden = new wxPanel(frame);
    auto* hiddenChild = new wxTextCtrl(hidden, wxID_ANY);
    hidden->Hide();
    frame->Show();
    wxYield();
    Check(!NavigationController::IsFocusable(hiddenChild));
    Check(!NavigationController::Focus(hiddenChild));

    auto* disabledTabOwner = new wxPanel(frame);
    NavigationController::BindTabNavigation(
        *disabledTabOwner,
        [text]()
        {
            NavigationController::Scope scope;
            scope.Add(text);
            return scope;
        },
        []() { return false; });
    wxKeyEvent disabledTab(wxEVT_CHAR_HOOK);
    disabledTab.m_keyCode = WXK_TAB;
    disabledTabOwner->GetEventHandler()->ProcessEvent(disabledTab);
    Check(disabledTab.GetSkipped());

    auto* emptyTabOwner = new wxPanel(frame);
    NavigationController::BindTabNavigation(
        *emptyTabOwner,
        []() { return NavigationController::Scope{}; });
    wxKeyEvent emptyTab(wxEVT_CHAR_HOOK);
    emptyTab.m_keyCode = WXK_TAB;
    emptyTabOwner->GetEventHandler()->ProcessEvent(emptyTab);
    Check(emptyTab.GetSkipped());

#ifdef __WXMSW__
#if wxUSE_ACCESSIBILITY
    auto* multiple = new wxListBox(frame, wxID_ANY, wxDefaultPosition,
        wxDefaultSize, 0, nullptr, wxLB_EXTENDED);
    multiple->Append("First");
    multiple->Append("Caret");
    multiple->Append("Last selected");
    ConfigureListBoxAsAccessibleList(*multiple, "Choices", {});
    multiple->SetSelection(0);
    multiple->SetSelection(2);
    multiple->SetFocus();
    SendMessage(reinterpret_cast<HWND>(multiple->GetHandle()), LB_SETCARETINDEX, 1, FALSE);
    DrainEvents();
    auto* multipleAccessible = multiple->GetAccessible();
    int childId = 0;
    wxAccessible* child = nullptr;
    Check(multipleAccessible->GetFocus(&childId, &child) == wxACC_OK);
    Check(childId == 2 && child == nullptr);
    for (int row = 1; row <= 3; ++row)
    {
        long state = 0;
        Check(multipleAccessible->GetState(row, &state) == wxACC_OK);
        Check(((state & wxACC_STATE_SYSTEM_FOCUSED) != 0) == (row == 2));
    }
    delete multiple;
#endif
    auto* input = new wxTextCtrl(frame, wxID_ANY, wxString{}, wxDefaultPosition,
        wxDefaultSize, wxTE_PROCESS_ENTER);
    auto* history = new wxTextCtrl(frame, wxID_ANY, "History", wxDefaultPosition,
        wxDefaultSize, wxTE_MULTILINE | wxTE_READONLY);
    auto* edit = new wxButton(frame, wxID_ANY, "Edit");
    auto* remove = new wxButton(frame, wxID_ANY, "Delete");
    lila::modules::chat::presentation::ChatEventBinder::Bind(
        *frame, {*input, *history, *edit, *remove}, {});
    history->SetFocus();
    DrainEvents();
    Check(history->HasFocus());
    observedWindow = reinterpret_cast<HWND>(history->GetHandle());
    const auto focusHook = SetWinEventHook(EVENT_OBJECT_FOCUS, EVENT_OBJECT_FOCUS,
        nullptr, ObserveEvent, GetCurrentProcessId(), 0, WINEVENT_OUTOFCONTEXT);
    Check(focusHook != nullptr);
    events.clear();
    NotifyWinEvent(EVENT_OBJECT_FOCUS, observedWindow, OBJID_CLIENT, CHILDID_SELF);
    DrainEvents();
    Check(events.size() == 1); // Verify the observer before checking for silence.
    events.clear();
    wxFocusEvent focus(wxEVT_SET_FOCUS, history->GetId());
    focus.SetEventObject(history);
    history->GetEventHandler()->ProcessEvent(focus);
    DrainEvents();
    Check(events.empty()); // A wx focus handler must not replay native focus.
    UnhookWinEvent(focusHook);

    observedWindow = reinterpret_cast<HWND>(status->GetHandle());
    constexpr DWORD LiveRegionChanged = 0x8019;
    const auto liveHook = SetWinEventHook(LiveRegionChanged, LiveRegionChanged,
        nullptr, ObserveEvent, GetCurrentProcessId(), 0, WINEVENT_OUTOFCONTEXT);
    Check(liveHook != nullptr);
    events.clear();
    AccessibilityUtils::AnnounceStatus(*status, "Ready");
    DrainEvents();
    Check(events.size() == 1);
    events.clear();
    AccessibilityUtils::AnnounceStatus(*status, wxString{});
    status->Hide();
    AccessibilityUtils::AnnounceStatus(*status, "Hidden");
    DrainEvents();
    Check(events.empty());
    UnhookWinEvent(liveHook);
#endif
    delete frame;
    delete wxHelpProvider::Set(previousHelp);
    static_cast<void>(wxTheApp->OnExit());
    wxEntryCleanup();
}
