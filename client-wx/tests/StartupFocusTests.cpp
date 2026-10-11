#include <cassert>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <thread>
#include <wx/app.h>
#include <wx/listbox.h>
#include <wx/log.h>
#include <wx/panel.h>
#include <wx/textctrl.h>
#include <wx/utils.h>
#include <windows.h>
#include "app/navigation/presentation/HostFrame.h"
#include "shared/accessibility/application/IScreenReaderAnnouncer.h"
#include "shared/accessibility/presentation/AccessibleMenu.h"
#include "shared/accessibility/presentation/FocusPlanView.h"

namespace
{
bool focused = false;
int synchronousCalls = 0;
int announcements = 0;
int titleChanges = 0;
WNDPROC originalFrameProc = nullptr;
LRESULT CALLBACK ObserveFrameTitle(HWND window, UINT message, WPARAM wParam, LPARAM lParam)
{
    if (message == WM_SETTEXT) ++titleChanges;
    return CallWindowProc(originalFrameProc, window, message, wParam, lParam);
}
class UnavailableReader final : public lila::shared::accessibility::IScreenReaderAnnouncer
{
public:
    bool Speak(std::wstring_view) const noexcept override
    {
        assert(focused); // The menu must already work when speech is attempted.
        ++announcements;
        return false;
    }
    bool SpeakAndWait(std::wstring_view) const noexcept override
    {
        ++synchronousCalls;
        return false;
    }
};
class UpdatingView final : public wxPanel,
    public lila::shared::accessibility::FocusPlanView
{
public:
    explicit UpdatingView(wxWindow* parent) : wxPanel(parent)
    {
        game = new wxTextCtrl(this, wxID_ANY, "Game", wxPoint(0, 0));
        chat = new wxTextCtrl(this, wxID_ANY, "Chat", wxPoint(0, 40));
    }
    lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override
    {
        lila::shared::accessibility::FocusManager::Plan plan;
        plan.AddWindow(game);
        return plan;
    }
    wxTextCtrl* game;
    wxTextCtrl* chat;
};

void CheckUnchangedScreenAfterInactivity(
    lila::app::navigation::HostFrame& frame, wxListBox& menu)
{
    // Override for a real prolonged wait without changing the screen or
    // injecting any keyboard input during the interval.
    wxString duration;
    long waitMs = 50;
    if (wxGetEnv("LILA_FOCUS_WAIT_MS", &duration))
    {
        const bool valid = duration.ToLong(&waitMs) && waitMs >= 0;
        assert(valid);
    }
    const auto wait = [waitMs]()
    {
        const auto until = std::chrono::steady_clock::now() +
            std::chrono::milliseconds(waitMs);
        while (std::chrono::steady_clock::now() < until)
        {
            wxYield();
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    };
    const int selection = menu.GetSelection();
    const auto assertMenuFocus = [&](const char* stage)
    {
        std::fprintf(stderr, "%s: active=%d, menuFocused=%d, selectionPreserved=%d\n",
            stage, frame.IsActive(), menu.HasFocus(), menu.GetSelection() == selection);
        assert(frame.IsActive());
        assert(menu.HasFocus() && menu.GetSelection() == selection);
#if wxUSE_ACCESSIBILITY
        auto* accessible = menu.GetAccessible();
        assert(accessible != nullptr);
        int childId = wxACC_SELF;
        wxAccessible* child = nullptr;
        assert(accessible->GetFocus(&childId, &child) == wxACC_OK);
        assert(child != nullptr);
        wxString name;
        assert(child->GetName(wxACC_SELF, &name) == wxACC_OK);
        assert(name == menu.GetString(selection));
        long state = 0;
        assert(child->GetState(wxACC_SELF, &state) == wxACC_OK);
        assert((state & wxACC_STATE_SYSTEM_FOCUSED) != 0);
#endif
    };
    wait();
    assertMenuFocus("After foreground wait");
    auto* other = new wxFrame(nullptr, wxID_ANY, "Inactivity test - other window");
    auto* field = new wxTextCtrl(other, wxID_ANY);
    other->Show();
    other->Raise();
    ::SetForegroundWindow(reinterpret_cast<HWND>(other->GetHandle()));
    field->SetFocus();
    wxYield();
    assert(field->HasFocus());
    wait();
    assert(field->HasFocus());
    frame.Raise();
    ::SetForegroundWindow(reinterpret_cast<HWND>(frame.GetHandle()));
    wxYield();
    assertMenuFocus("After return from background wait");
    other->Destroy();
    wxYield();
}

void CheckRealtimeFocusRecovery(lila::app::navigation::HostFrame& frame)
{
    auto* view = new UpdatingView(frame.ContentParent());
    frame.SetContent(view);
    view->chat->SetFocus();
    wxYield();
    assert(view->chat->HasFocus());
    int focusEvents = 0;
    view->chat->Bind(wxEVT_SET_FOCUS, [&focusEvents](wxFocusEvent& event)
    {
        ++focusEvents;
        event.Skip();
    });
    const auto idle = [&frame]()
    {
        wxIdleEvent event;
        frame.GetEventHandler()->ProcessEvent(event);
    };
    for (int i = 0; i < 10; ++i) idle();
    assert(view->chat->HasFocus() && focusEvents == 0);

    // Native restoration can land on a layout panel. It must neither replace
    // the remembered chat control nor remain an unnamed keyboard destination.
    ::SetFocus(reinterpret_cast<HWND>(view->GetHandle()));
    assert(wxWindow::FindFocus() == view);
    idle();
    assert(view->chat->HasFocus() && focusEvents == 1);

    // A realtime update removes the active control while the app stays open.
    view->chat->Destroy();
    wxYield();
    ::SetFocus(reinterpret_cast<HWND>(view->GetHandle()));
    idle();
    assert(view->game->HasFocus());

    auto* other = new wxFrame(nullptr, wxID_ANY, "Other application");
    auto* otherInput = new wxTextCtrl(other, wxID_ANY);
    other->Show();
    other->Raise();
    ::SetForegroundWindow(reinterpret_cast<HWND>(other->GetHandle()));
    otherInput->SetFocus();
    wxYield();
    assert(!frame.IsActive() && otherInput->HasFocus());
    view->game->Hide();
    view->game = new wxTextCtrl(view, wxID_ANY, "Updated game", wxPoint(0, 80));
    idle();
    assert(otherInput->HasFocus());

    frame.Raise();
    ::SetForegroundWindow(reinterpret_cast<HWND>(frame.GetHandle()));
    ::SetFocus(reinterpret_cast<HWND>(view->GetHandle()));
    wxActivateEvent activate(wxEVT_ACTIVATE, true, frame.GetId());
    frame.GetEventHandler()->ProcessEvent(activate);
    wxYield();
    assert(view->game->HasFocus());
    other->Destroy();
    wxYield();
}
}
namespace lila::shared::accessibility
{
std::unique_ptr<IScreenReaderAnnouncer> CreateScreenReaderAnnouncer()
{
    return std::make_unique<UnavailableReader>();
}
}
class StartupFocusApp final : public wxApp
{
public:
    bool OnInit() override { return true; }
};
wxIMPLEMENT_APP_NO_MAIN(StartupFocusApp);

int main(int argc, char** argv)
{
#ifdef _MSC_VER
    _set_error_mode(_OUT_TO_STDERR);
#endif
    delete wxLog::SetActiveTarget(new wxLogStderr());
    assert(wxEntryStart(argc, argv));
    assert(wxTheApp->CallOnInit());
    auto* frame = new lila::app::navigation::HostFrame();
    const auto nativeFrame = reinterpret_cast<HWND>(frame->GetHandle());
    originalFrameProc = reinterpret_cast<WNDPROC>(SetWindowLongPtr(
        nativeFrame, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(&ObserveFrameTitle)));
    auto* menu = new wxListBox(frame->ContentParent(), wxID_ANY);
    menu->Append("First item");
    menu->Append("Second item");
    menu->SetSelection(0);
    lila::shared::accessibility::ConfigureListBoxAsAccessibleList(*menu, "Main menu", {});
    frame->SetContent(menu);
    frame->BeginInitialFocusAnnouncement();
    frame->Show();
    frame->Raise();
    wxYield();
    frame->CompleteInitialFocusAnnouncement([&](bool includeContext)
    {
        assert(includeContext);
        frame->PrepareActivationFocusContext(menu);
        menu->SetFocus();
        focused = menu->HasFocus();
    });
    assert(focused); // No background executor or speech completion is needed.
    assert(titleChanges == 0); // Showing/focusing must not re-emit the existing title.
    assert(synchronousCalls == 0);
    // Lists rely on native ancestor speech; items must not repeat the title.
    for (int turn = 0; turn < 10; ++turn)
    {
        frame->CallAfter([] {});
        wxYield();
        const auto name = lila::shared::accessibility::ActivationFocusContext::AccessibleNameFor(
            *menu, "First item");
        assert(name == "First item" && menu->GetName() == "Main menu");
    }
    assert(announcements == 0 && synchronousCalls == 0);
    wxKeyEvent navigation(wxEVT_CHAR_HOOK);
    navigation.m_keyCode = WXK_DOWN;
    frame->GetEventHandler()->ProcessEvent(navigation);
    menu->SetSelection(1);
    assert(lila::shared::accessibility::ActivationFocusContext::AccessibleNameFor(
        *menu, "Second item") == "Second item");
    assert(menu->HasFocus() && menu->GetSelection() == 1);
    wxActivateEvent deactivate(wxEVT_ACTIVATE, false, frame->GetId());
    frame->GetEventHandler()->ProcessEvent(deactivate);
    wxActivateEvent activate(wxEVT_ACTIVATE, true, frame->GetId());
    frame->GetEventHandler()->ProcessEvent(activate);
    // Reactivation must not duplicate the title on the list item either.
    assert(lila::shared::accessibility::ActivationFocusContext::AccessibleNameFor(
        *menu, "Second item") == "Second item");
    assert(menu->HasFocus() && menu->GetSelection() == 1);
    // Interaction before the activation callback must not reintroduce the title.
    frame->GetEventHandler()->ProcessEvent(navigation);
    wxYield();
    assert(lila::shared::accessibility::ActivationFocusContext::AccessibleNameFor(
        *menu, "Second item") == "Second item");
    assert(announcements == 0 && synchronousCalls == 0);
    SetWindowLongPtr(nativeFrame, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(originalFrameProc));
    CheckUnchangedScreenAfterInactivity(*frame, *menu);
    CheckRealtimeFocusRecovery(*frame);
    frame->Destroy();
    wxTheApp->ProcessPendingEvents();
    wxTheApp->OnExit();
    wxEntryCleanup();
}
