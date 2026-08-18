#pragma once

#include <cstddef>
#include <functional>

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

    bool FocusFirstSectionControl(std::size_t sectionIndex);
    void BindNavigation(wxWindow& owner, std::function<bool()> isInsideSection);
    bool FocusNextSectionControl();

private:
    OptionsView& view_;
};
}
