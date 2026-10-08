#include <cassert>
#include <wx/app.h>
#include <wx/listbox.h>
#include <wx/log.h>
#include "app/navigation/presentation/HostFrame.h"
#include "shared/accessibility/application/IScreenReaderAnnouncer.h"

namespace
{
bool focused = false;
int synchronousCalls = 0;
int announcements = 0;
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
    delete wxLog::SetActiveTarget(new wxLogStderr());
    assert(wxEntryStart(argc, argv));
    assert(wxTheApp->CallOnInit());
    auto* frame = new lila::app::navigation::HostFrame();
    auto* menu = new wxListBox(frame->ContentParent(), wxID_ANY);
    menu->Append("First item");
    menu->Append("Second item");
    menu->SetSelection(0);
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
    assert(synchronousCalls == 0);
    // Delayed accessibility reads must still include the complete title.
    for (int turn = 0; turn < 10; ++turn)
    {
        frame->CallAfter([] {});
        wxYield();
        const auto name = lila::shared::accessibility::ActivationFocusContext::AccessibleNameFor(
            *menu, "First item");
        assert(name.StartsWith(frame->GetTitle()) && name.EndsWith("First item"));
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
    // Reactivation must restore the title before any deferred callback runs.
    assert(lila::shared::accessibility::ActivationFocusContext::AccessibleNameFor(
        *menu, "Second item").StartsWith(frame->GetTitle()));
    assert(menu->HasFocus() && menu->GetSelection() == 1);
    // Interaction before the activation callback must not reintroduce the title.
    frame->GetEventHandler()->ProcessEvent(navigation);
    wxYield();
    assert(lila::shared::accessibility::ActivationFocusContext::AccessibleNameFor(
        *menu, "Second item") == "Second item");
    assert(announcements == 0 && synchronousCalls == 0);
    frame->Destroy();
    wxTheApp->ProcessPendingEvents();
    wxTheApp->OnExit();
    wxEntryCleanup();
}
