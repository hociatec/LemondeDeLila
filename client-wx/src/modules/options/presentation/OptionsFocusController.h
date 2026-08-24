#pragma once

#include <cstddef>
#include <functional>

#include "shared/accessibility/FocusManager.h"

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

    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildSectionMenuPlan(std::size_t sectionIndex);
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFirstSectionControlPlan(std::size_t sectionIndex);
    void BindNavigation(wxWindow& owner, std::function<bool()> isInsideSection);
    bool FocusNextSectionControl();

private:
    OptionsView& view_;
};
}
