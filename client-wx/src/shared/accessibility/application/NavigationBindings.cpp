#include "shared/accessibility/application/NavigationController.h"

#include <utility>

namespace lila::shared::accessibility
{
void NavigationController::BindTabNavigation(
    wxWindow& window,
    ScopeProvider scopeProvider,
    Predicate enabled,
    Boundary boundary)
{
    window.Bind(
        wxEVT_CHAR_HOOK,
        [scopeProvider = std::move(scopeProvider), enabled = std::move(enabled), boundary](wxKeyEvent& event)
        {
            if (!IsTabKey(event.GetKeyCode()))
            {
                event.Skip();
                return;
            }
            if (enabled && !enabled())
            {
                event.Skip(false);
                return;
            }
            Scope scope = scopeProvider ? scopeProvider() : Scope{};
            if (!Move(scope, event.ShiftDown() ? Direction::Backward : Direction::Forward, boundary))
            {
                event.Skip(false);
            }
        });
}

void NavigationController::BindEscapeNavigation(
    wxWindow& window,
    EscapeHandler handler,
    Predicate enabled)
{
    window.Bind(
        wxEVT_CHAR_HOOK,
        [handler = std::move(handler), enabled = std::move(enabled)](wxKeyEvent& event)
        {
            if (event.GetKeyCode() != WXK_ESCAPE)
            {
                event.Skip();
                return;
            }
            if (enabled && !enabled())
            {
                event.Skip();
                return;
            }
            if (!handler || !handler())
            {
                event.Skip();
            }
        });
}

void NavigationController::BindVerticalNavigation(
    wxWindow& window,
    ScopeProvider scopeProvider,
    Predicate enabled,
    Boundary boundary)
{
    window.Bind(
        wxEVT_CHAR_HOOK,
        [scopeProvider = std::move(scopeProvider), enabled = std::move(enabled), boundary](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            if (!IsVerticalKey(key))
            {
                event.Skip();
                return;
            }
            if (enabled && !enabled())
            {
                event.Skip();
                return;
            }
            Scope scope = scopeProvider ? scopeProvider() : Scope{};
            if (!HandleVertical(event, scope, boundary))
            {
                event.Skip();
            }
        });
}

}
