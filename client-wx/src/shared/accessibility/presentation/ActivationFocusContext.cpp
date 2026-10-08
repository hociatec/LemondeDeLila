#include "shared/accessibility/presentation/ActivationFocusContext.h"

#include <utility>

#include <wx/access.h>
#include <wx/weakref.h>
#include <wx/window.h>

namespace lila::shared::accessibility
{
struct ActivationFocusContext::State final
{
    wxWeakRef<wxWindow> target;
    wxString originalName;
    wxString announcedName;
    wxString prefix;
};

namespace
{
void* ActiveState = nullptr;

wxString ResolveAccessibleName(wxWindow& target)
{
#if wxUSE_ACCESSIBILITY
    if (auto* accessible = target.GetAccessible())
    {
        int childId = wxACC_SELF;
        wxAccessible* child = nullptr;
        if (accessible->GetFocus(&childId, &child) == wxACC_OK && child != nullptr)
        {
            wxString name;
            if (child->GetName(wxACC_SELF, &name) == wxACC_OK && !name.empty())
                return name;
        }
        wxString name;
        if (accessible->GetName(childId, &name) == wxACC_OK && !name.empty())
            return name;
    }
#endif
    if (!target.GetName().empty()) return target.GetName();
    return target.GetLabel();
}
}

ActivationFocusContext::ActivationFocusContext()
    : state_(std::make_unique<State>())
{
}

ActivationFocusContext::~ActivationFocusContext()
{
    Clear();
}

void ActivationFocusContext::Prepare(wxWindow* target, const wxString& windowContext)
{
    Clear();
    if (target == nullptr || windowContext.empty()) return;

    state_->target = target;
    state_->originalName = target->GetName();
    state_->prefix = windowContext;
    const auto focusedName = ResolveAccessibleName(*target);
    state_->announcedName = windowContext;
    if (!focusedName.empty() && !focusedName.StartsWith(windowContext))
        state_->announcedName += wxString(L" — ") + focusedName;
    target->SetName(state_->announcedName);
    ActiveState = state_.get();
}

void ActivationFocusContext::Clear()
{
    if (ActiveState == state_.get()) ActiveState = nullptr;
    auto* target = state_->target.get();
    if (target != nullptr && target->GetName() == state_->announcedName)
        target->SetName(state_->originalName);
    state_->target = nullptr;
    state_->originalName.clear();
    state_->announcedName.clear();
    state_->prefix.clear();
}

wxString ActivationFocusContext::Announcement() const
{
    return state_->announcedName;
}

wxString ActivationFocusContext::AccessibleNameFor(
    const wxWindow& window,
    const wxString& name)
{
    const auto* activeState = static_cast<const State*>(ActiveState);
    if (activeState == nullptr || activeState->target.get() != &window ||
        activeState->prefix.empty() || name.StartsWith(activeState->prefix))
        return name;
    return activeState->prefix + wxString(L" — ") + name;
}
}
