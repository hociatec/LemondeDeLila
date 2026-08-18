#pragma once

#include <cstddef>
#include <functional>

class wxFrame;

namespace lila::modules::options::presentation
{
class OptionsFocusController;
class OptionsView;

class OptionsEventBinder final
{
public:
    struct Handlers
    {
        std::function<void(std::size_t)> activateSection;
        std::function<void()> cancelChanges;
        std::function<void()> refreshUnsavedState;
        std::function<void()> handleEscape;
        std::function<bool()> isInsideSection;
        std::function<void()> onExitRequested;
    };

    static void Bind(
        wxFrame& frame,
        OptionsView& view,
        OptionsFocusController& focusController,
        Handlers handlers);
};
}
