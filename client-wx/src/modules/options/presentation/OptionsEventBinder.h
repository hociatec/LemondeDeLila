#pragma once

#include <cstddef>
#include <functional>

class wxWindow;

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
        std::function<void(std::size_t)> selectSection;
        std::function<void()> cancelChanges;
        std::function<void()> stateChanged;
        std::function<void()> saveState;
        std::function<void()> handleEscape;
        std::function<bool()> isInsideSection;
    };

    static void Bind(
        wxWindow& owner,
        OptionsView& view,
        OptionsFocusController& focusController,
        Handlers handlers);
};
}
