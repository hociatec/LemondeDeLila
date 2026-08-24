#pragma once

#include <functional>
#include <string>

class wxWindow;

namespace lila::modules::social::presentation
{
class SocialNavigationState;

class SocialEventRouter final
{
public:
    struct Handlers
    {
        std::function<void()> handleEscape;
        std::function<void()> closeSectionActionMenu;
        std::function<void()> activateProfileEditorSelection;
        std::function<void(const std::string&)> reportError;
        std::function<void()> beginClosing;
        std::function<void()> onExitRequested;
    };

    static void BindRootEvents(
        wxWindow& owner,
        SocialNavigationState& navigationState,
        Handlers handlers);
};
}
