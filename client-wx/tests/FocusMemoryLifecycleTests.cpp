#include <cassert>

#include <wx/app.h>
#include <wx/frame.h>
#include <wx/panel.h>
#include <wx/textctrl.h>

#include "shared/accessibility/presentation/FocusMemory.h"

class FocusMemoryTestApp final : public wxApp
{
public:
    bool OnInit() override { return true; }
};
wxIMPLEMENT_APP_NO_MAIN(FocusMemoryTestApp);

int main(int argc, char** argv)
{
    assert(wxEntryStart(argc, argv));
    assert(wxTheApp->CallOnInit());

    auto* frame = new wxFrame(nullptr, wxID_ANY, "focus-memory-test");
    auto* scope = new wxPanel(frame);
    auto* target = new wxTextCtrl(scope, wxID_ANY);
    frame->Show();
    target->SetFocus();
    wxYield();

    lila::shared::accessibility::FocusMemory memory;
    memory.Remember(scope);
    assert(memory.RememberedScopeCount() == 1);

    scope->Destroy();
    wxYield();
    memory.PruneExpired();
    assert(memory.RememberedScopeCount() == 0);

    delete frame;
    static_cast<void>(wxTheApp->OnExit());
    wxEntryCleanup();
}
