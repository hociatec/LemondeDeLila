#pragma once

#include <functional>
#include <string>

class wxFrame;

namespace lila::modules::social::presentation
{
class SocialFocusController;
class SocialNavigationState;
class SocialView;

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
        wxFrame& frame,
        SocialView& view,
        SocialNavigationState& navigationState,
        SocialFocusController& focusController,
        Handlers handlers);
};
}
