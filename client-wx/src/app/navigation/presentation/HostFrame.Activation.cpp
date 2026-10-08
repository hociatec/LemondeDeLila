#include "app/navigation/presentation/HostFrame.h"

#ifdef __WXMSW__

#include <wx/window.h>

#include "shared/accessibility/presentation/NavigationController.h"

namespace lila::app::navigation
{
void HostFrame::OnActivate(wxActivateEvent& event)
{
    if (!event.GetActive())
    {
        auto* target = wxWindow::FindFocus();
        if (!lila::shared::accessibility::NavigationController::IsDescendantOf(
                target, currentContent_))
            target = lastFocusedChild_.get();
        if (lila::shared::accessibility::NavigationController::IsDescendantOf(
                target, currentContent_))
            lastFocusedChild_ = target;
        ClearActivationFocusContext();
    }
    else
    {
        const wxWeakRef<HostFrame> weakFrame(this);
        const wxWeakRef<wxWindow> weakTarget(lastFocusedChild_.get());
        CallAfter([weakFrame, weakTarget]()
        {
            auto* frame = weakFrame.get();
            auto* target = weakTarget.get();
            if (frame == nullptr || target == nullptr || !frame->IsActive() ||
                !lila::shared::accessibility::NavigationController::IsDescendantOf(
                    target, frame->currentContent_)) return;

            // Windows normally restores the child focus while activating the
            // window. Re-focusing it emits a second accessibility event which
            // interrupts NVDA while it is still announcing the window title.
            auto* focused = wxWindow::FindFocus();
            if (lila::shared::accessibility::NavigationController::IsDescendantOf(
                    focused, frame->currentContent_))
            {
                frame->lastFocusedChild_ = focused;
                return;
            }
            static_cast<void>(
                lila::shared::accessibility::NavigationController::Focus(target));
        });
    }
    event.Skip();
}

void HostFrame::OnChildFocus(wxChildFocusEvent& event)
{
    auto* focused = event.GetWindow();
    if (IsActive() && focused != nullptr &&
        lila::shared::accessibility::NavigationController::IsDescendantOf(
            focused, currentContent_))
        lastFocusedChild_ = focused;
    event.Skip();
}
}

#endif
