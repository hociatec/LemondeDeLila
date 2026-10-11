#include "app/navigation/presentation/HostFrame.h"

#ifdef __WXMSW__

#include <wx/window.h>
#include <wx/panel.h>

#include "shared/accessibility/presentation/NavigationController.h"
#include "shared/accessibility/presentation/FocusPlanView.h"
#include "shared/accessibility/presentation/FocusCoordinator.h"

namespace lila::app::navigation
{
namespace
{
bool IsContentFocus(wxWindow* target, wxWindow* content)
{
    // Layout panels can accept native focus after their focused child is
    // hidden. They are not an interactive destination for keyboard users.
    return dynamic_cast<wxPanel*>(target) == nullptr &&
        lila::shared::accessibility::NavigationController::IsFocusable(target) &&
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
        CallAfter([weakFrame]()
        {
            if (weakFrame) weakFrame->RestoreContentFocus();
        });
    }
    event.Skip();
}

void HostFrame::RestoreContentFocus()
{
    if (!IsActive() || !IsEnabled() || !IsShownOnScreen()) return;
    auto* focused = wxWindow::FindFocus();
    // A dialog or another top-level window owns its own focus lifecycle.
    if (focused != nullptr && wxGetTopLevelParent(focused) != this) return;
    if (IsContentFocus(focused, currentContent_))
    {
        if (activationContextPending_) PrepareActivationFocusContext(focused);
        activationContextPending_ = false;
        lastFocusedChild_ = focused;
        return; // No duplicate focus event or speech for an unchanged control.
    }
    auto* target = lastFocusedChild_.get();
    if (IsContentFocus(target, currentContent_))
    {
        if (activationContextPending_) PrepareActivationFocusContext(target);
        if (lila::shared::accessibility::NavigationController::Focus(target)) return;
    }
    // Resolve against the current view: realtime updates may have destroyed
    // or hidden the remembered control while this window was in the background.
    if (auto* view = dynamic_cast<lila::shared::accessibility::FocusPlanView*>(currentContent_))
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(
            view->BuildFocusPlan(), [this](wxWindow* resolvedTarget)
            {
                if (activationContextPending_) PrepareActivationFocusContext(resolvedTarget);
            }));
}

void HostFrame::OnChildFocus(wxChildFocusEvent& event)
{
    auto* focused = event.GetWindow();
    if (IsActive() && IsContentFocus(focused, currentContent_))
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
