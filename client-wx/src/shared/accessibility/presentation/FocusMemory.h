#pragma once

#include <list>

#include <wx/weakref.h>

#include "shared/accessibility/presentation/FocusManager.h"

class wxWindow;

namespace lila::shared::accessibility
{
class FocusMemory final
{
public:
    void Remember(wxWindow* scope);
    [[nodiscard]] bool Restore(
        wxWindow* scope,
        const FocusManager::BeforeFocus& beforeFocus = {});
    void Forget(wxWindow* scope);
    void Clear();
    void PruneExpired();
    [[nodiscard]] std::size_t RememberedScopeCount() const noexcept;

private:
    struct Entry final
    {
        Entry(wxWindow* rememberedScope, wxWindow* rememberedTarget)
            : scope(rememberedScope), target(rememberedTarget)
        {
        }
        wxWeakRef<wxWindow> scope;
        wxWeakRef<wxWindow> target;
    };
    std::list<Entry> targets_;
};
}
