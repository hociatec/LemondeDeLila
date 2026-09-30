#pragma once

#include <unordered_map>

#include <wx/weakref.h>

class wxWindow;

namespace lila::shared::accessibility
{
class FocusMemory final
{
public:
    void Remember(wxWindow* scope);
    [[nodiscard]] bool Restore(wxWindow* scope);
    void Forget(wxWindow* scope);
    void Clear();

private:
    std::unordered_map<wxWindow*, wxWeakRef<wxWindow>> targets_;
};
}
