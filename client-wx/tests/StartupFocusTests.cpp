#include <cassert>
#include <wx/app.h>
#include <wx/listbox.h>
#include <wx/log.h>
#include "app/navigation/presentation/HostFrame.h"

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
    menu->SetSelection(1); // A delayed announcement must not reset navigation.
    wxYield();
    assert(announcements == 1);
    assert(menu->HasFocus() && menu->GetSelection() == 1);
    frame->Destroy();
    wxTheApp->ProcessPendingEvents();
    wxTheApp->OnExit();
    wxEntryCleanup();
}
