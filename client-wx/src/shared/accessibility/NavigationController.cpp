#include "shared/accessibility/NavigationController.h"

#include <algorithm>
#include <utility>

namespace lila::shared::accessibility
{
NavigationController::Target::Target(wxWindow* window)
    : resolver_([window] { return window; })
{
}

NavigationController::Target::Target(Resolver resolver)
    : resolver_(std::move(resolver))
{
}

wxWindow* NavigationController::Target::Resolve() const
{
    return resolver_ ? resolver_() : nullptr;
}

NavigationController::Scope& NavigationController::Scope::Add(wxWindow* window)
{
    targets_.emplace_back(window);
    return *this;
}

NavigationController::Scope& NavigationController::Scope::Add(Resolver resolver)
{
    targets_.emplace_back(std::move(resolver));
    return *this;
}

NavigationController::Scope& NavigationController::Scope::Add(std::initializer_list<wxWindow*> windows)
{
    for (wxWindow* window : windows)
    {
        Add(window);
    }
    return *this;
}

void NavigationController::Scope::Clear()
{
    targets_.clear();
}

bool NavigationController::Scope::Empty() const
{
    return targets_.empty();
}

bool NavigationController::IsTabKey(int keyCode) noexcept
{
    return keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB;
}

bool NavigationController::IsVerticalKey(int keyCode) noexcept
{
    return keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP || keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN;
}

std::size_t NavigationController::ComputeTargetIndex(
    std::size_t itemCount,
    std::size_t currentIndex,
    Direction direction,
    Boundary boundary) noexcept
{
    if (itemCount == 0)
    {
        return 0;
    }

    if (currentIndex >= itemCount)
    {
        return direction == Direction::Backward ? itemCount - 1 : 0;
    }

    if (direction == Direction::Backward)
    {
        if (currentIndex > 0)
        {
            return currentIndex - 1;
        }
        return boundary == Boundary::Wrap ? itemCount - 1 : 0;
    }

    if (currentIndex + 1 < itemCount)
    {
        return currentIndex + 1;
    }

    return boundary == Boundary::Wrap ? 0 : itemCount - 1;
}

bool NavigationController::IsFocusable(const wxWindow* window)
{
    return window != nullptr && window->IsShown() && window->IsEnabled() && window->AcceptsFocus();
}

bool NavigationController::IsDescendantOf(const wxWindow* window, const wxWindow* ancestor)
{
    if (window == nullptr || ancestor == nullptr)
    {
        return false;
    }

    const wxWindow* current = window;
    while (current != nullptr)
    {
        if (current == ancestor)
        {
            return true;
        }
        current = current->GetParent();
    }
    return false;
}

std::vector<wxWindow*> NavigationController::Resolve(const Scope& scope)
{
    std::vector<wxWindow*> result;
    result.reserve(scope.targets_.size());
    for (const Target& target : scope.targets_)
    {
        wxWindow* window = target.Resolve();
        if (IsFocusable(window) && std::find(result.begin(), result.end(), window) == result.end())
        {
            result.push_back(window);
        }
    }
    return result;
}

wxWindow* NavigationController::First(const Scope& scope)
{
    const auto controls = Resolve(scope);
    return controls.empty() ? nullptr : controls.front();
}

wxWindow* NavigationController::Last(const Scope& scope)
{
    const auto controls = Resolve(scope);
    return controls.empty() ? nullptr : controls.back();
}

bool NavigationController::Contains(const Scope& scope, wxWindow* window)
{
    const auto controls = Resolve(scope);
    return std::find(controls.begin(), controls.end(), window) != controls.end();
}

bool NavigationController::Focus(wxWindow* window)
{
    if (!IsFocusable(window))
    {
        return false;
    }
    if (wxWindow::FindFocus() != window)
    {
        window->SetFocus();
    }
    return true;
}

bool NavigationController::FocusFirst(const Scope& scope)
{
    return Focus(First(scope));
}

bool NavigationController::FocusLast(const Scope& scope)
{
    return Focus(Last(scope));
}

bool NavigationController::Move(
    const Scope& scope,
    Direction direction,
    Boundary boundary,
    wxWindow* focused)
{
    const auto controls = Resolve(scope);
    if (controls.empty())
    {
        return false;
    }

    auto current = std::find(controls.begin(), controls.end(), focused);
    if (current == controls.end())
    {
        return direction == Direction::Backward ? Focus(controls.back()) : Focus(controls.front());
    }

    const std::size_t index = static_cast<std::size_t>(std::distance(controls.begin(), current));
    const std::size_t target = ComputeTargetIndex(controls.size(), index, direction, boundary);
    return Focus(controls[target]);
}

bool NavigationController::MoveCyclic(const Scope& scope, bool reverse, wxWindow* focused)
{
    return Move(scope, reverse ? Direction::Backward : Direction::Forward, Boundary::Wrap, focused);
}

bool NavigationController::MoveLinear(const Scope& scope, bool reverse, wxWindow* focused)
{
    return Move(scope, reverse ? Direction::Backward : Direction::Forward, Boundary::Clamp, focused);
}

bool NavigationController::WrapBoundary(const Scope& scope, bool reverse, wxWindow* owner)
{
    wxWindow* first = First(scope);
    wxWindow* last = Last(scope);
    wxWindow* focused = wxWindow::FindFocus();
    if (first == nullptr || last == nullptr)
    {
        return false;
    }
    if (focused == nullptr)
    {
        return reverse ? Focus(last) : Focus(first);
    }
    if (!reverse && focused == last)
    {
        return Focus(first);
    }
    if (reverse && focused == first)
    {
        return Focus(last);
    }
    if (owner != nullptr)
    {
        wxWindow* ancestor = focused;
        while (ancestor != nullptr && ancestor != owner)
        {
            ancestor = ancestor->GetParent();
        }
        if (ancestor == nullptr)
        {
            return reverse ? Focus(last) : Focus(first);
        }
    }
    return false;
}

bool NavigationController::HandleTab(wxKeyEvent& event, const Scope& scope, Boundary boundary)
{
    if (!IsTabKey(event.GetKeyCode()))
    {
        return false;
    }
    return Move(scope, event.ShiftDown() ? Direction::Backward : Direction::Forward, boundary);
}

bool NavigationController::HandleVertical(wxKeyEvent& event, const Scope& scope, Boundary boundary)
{
    const int key = event.GetKeyCode();
    if (key == WXK_UP || key == WXK_NUMPAD_UP)
    {
        return Move(scope, Direction::Backward, boundary);
    }
    if (key == WXK_DOWN || key == WXK_NUMPAD_DOWN)
    {
        return Move(scope, Direction::Forward, boundary);
    }
    return false;
}

bool NavigationController::HandleEscapeBacktrack(
    wxWindow* currentContainer,
    wxWindow* fallbackTarget,
    wxWindow* focused)
{
    if (!IsDescendantOf(focused, currentContainer))
    {
        return false;
    }

    return Focus(fallbackTarget);
}

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

void NavigationController::BindBoundaryTabNavigation(
    wxWindow& window,
    ScopeProvider scopeProvider,
    wxWindow* owner,
    Predicate enabled)
{
    window.Bind(
        wxEVT_CHAR_HOOK,
        [scopeProvider = std::move(scopeProvider), owner, enabled = std::move(enabled)](wxKeyEvent& event)
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
            if (!WrapBoundary(scope, event.ShiftDown(), owner))
            {
                event.Skip(false);
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

bool NavigationController::HandleDirectedTab(wxKeyEvent& event, wxWindow* backwardTarget, wxWindow* forwardTarget)
{
    if (!IsTabKey(event.GetKeyCode()))
    {
        return false;
    }
    return Focus(event.ShiftDown() ? backwardTarget : forwardTarget);
}
}
