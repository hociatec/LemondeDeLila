#pragma once

#include <memory>

#include <wx/string.h>

class wxWindow;

namespace lila::shared::accessibility
{
class ActivationFocusContext final
{
public:
    ActivationFocusContext();
    ~ActivationFocusContext();

    ActivationFocusContext(const ActivationFocusContext&) = delete;
    ActivationFocusContext& operator=(const ActivationFocusContext&) = delete;

    void Prepare(wxWindow* target, const wxString& windowContext);
    void Clear();
    void ClearIfFocusChanged(wxWindow* target);
    [[nodiscard]] wxString Announcement() const;

    [[nodiscard]] static wxString AccessibleNameFor(
        const wxWindow& window,
        const wxString& name);

private:
    struct State;
    std::unique_ptr<State> state_;
};
}
