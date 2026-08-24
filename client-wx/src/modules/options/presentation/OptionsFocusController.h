#pragma once

#include "shared/accessibility/application/FocusManager.h"

class wxWindow;

namespace lila::modules::options::presentation
{
class OptionsView;

// Centralizes keyboard focus rules for option sections. Keeping these rules
// outside OptionsFrame makes the frame an event/application orchestrator only.
class OptionsFocusController final
{
public:
    explicit OptionsFocusController(OptionsView& view) noexcept;

    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildSectionTabsPlan();
    void BindNavigation(wxWindow& owner);
    bool FocusNextSectionControl();

private:
    OptionsView& view_;
};
}
