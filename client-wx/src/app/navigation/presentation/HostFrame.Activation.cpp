#include "app/navigation/presentation/HostFrame.h"

#ifdef __WXMSW__

#include <wx/window.h>

#include "shared/accessibility/presentation/NavigationController.h"
#include "shared/accessibility/presentation/FocusPlanView.h"
#include "shared/accessibility/presentation/FocusCoordinator.h"

namespace lila::app::navigation
{
namespace
{
bool IsContentFocus(wxWindow* target, wxWindow* content)
{
    return lila::shared::accessibility::NavigationController::IsFocusable(target) &&
        lila::shared::accessibility::NavigationController::IsDescendantOf(target, content);
}
}

void HostFrame::OnActivate(wxActivateEvent& event)
{
    if (!event.GetActive())
    {
        auto* target = wxWindow::FindFocus();
        if (!IsContentFocus(target, currentContent_))
            target = lastFocusedChild_.get();
        if (IsContentFocus(target, currentContent_))
            lastFocusedChild_ = target;
        ClearActivationFocusContext();
    }
    else
    {
        // Prepare before Windows/NVDA consumes the activation focus event.
        // Deactivation clears this context, so startup preparation alone is
        // insufficient for Alt+Tab or a delayed first foreground activation.
        activationContextPending_ = true;
        auto* initialTarget = wxWindow::FindFocus();
        if (!IsContentFocus(initialTarget, currentContent_))
            initialTarget = lastFocusedChild_.get();
        if (IsContentFocus(initialTarget, currentContent_))
            PrepareActivationFocusContext(initialTarget);
        const wxWeakRef<HostFrame> weakFrame(this);
        const wxWeakRef<wxWindow> weakTarget(lastFocusedChild_.get());
        CallAfter([weakFrame, weakTarget]()
        {
            auto* frame = weakFrame.get();
            auto* target = weakTarget.get();
            if (frame == nullptr || !frame->IsActive()) return;

            // Windows normally restores the child focus while activating the
            // window. Re-focusing it emits a second accessibility event which
            // interrupts NVDA while it is still announcing the window title.
            auto* focused = wxWindow::FindFocus();
            if (IsContentFocus(focused, frame->currentContent_))
            {
                if (frame->activationContextPending_)
                    frame->PrepareActivationFocusContext(focused);
                frame->activationContextPending_ = false;
                frame->lastFocusedChild_ = focused;
                return;
            }
            if (IsContentFocus(target, frame->currentContent_))
            {
                if (frame->activationContextPending_)
                    frame->PrepareActivationFocusContext(target);
                if (lila::shared::accessibility::NavigationController::Focus(target)) return;
            }
            // Initial activation can occur before any valid child was remembered.
            // A container is not an accessible menu item: use the view's focus plan.
            if (auto* view = dynamic_cast<lila::shared::accessibility::FocusPlanView*>(
                    frame->currentContent_))
                static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(
                    view->BuildFocusPlan(), [frame](wxWindow* resolvedTarget)
                    {
                        if (frame->activationContextPending_)
                            frame->PrepareActivationFocusContext(resolvedTarget);
                    }));
        });
    }
    event.Skip();
}

void HostFrame::OnChildFocus(wxChildFocusEvent& event)
{
    auto* focused = event.GetWindow();
    if (IsContentFocus(focused, currentContent_))
    {
        if (activationContextPending_)
        {
            PrepareActivationFocusContext(focused);
            activationContextPending_ = false;
        }
        else
            activationFocusContext_.ClearIfFocusChanged(focused);
        lastFocusedChild_ = focused;
    }
    event.Skip();
}
}

#endif
