#include "modules/options/presentation/OptionsFocusController.h"

#include <wx/defs.h>
#include <wx/window.h>
#include <wx/slider.h>

#include "modules/options/presentation/OptionsView.h"
#include "shared/accessibility/NavigationController.h"

namespace lila::modules::options::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;

Navigator::Scope BuildSectionScope(OptionsView& view, int sectionIndex)
{
    Navigator::Scope scope;
    switch (sectionIndex)
    {
    case 0:
        scope.Add({
            view.confirmExitCheckbox,
            view.restoreSessionCheckbox,
            view.showNavigationStatusCheckbox,
            view.enableBetaGamesCheckbox});
        break;
    case 1:
        scope.Add({
            view.muteAllCheckbox,
            view.soundAmbienceCheckbox,
            view.soundMenuAmbienceSlider,
            view.soundTavernAmbienceSlider,
            view.soundAppLaunchCheckbox,
            view.soundAppLaunchSlider,
            view.soundNavigateCheckbox,
            view.soundNavigateSlider,
            view.soundSelectCheckbox,
            view.soundSelectSlider,
            view.soundChatMessagesCheckbox,
            view.soundChatMessagesSlider});
        break;
    case 2:
        scope.Add({view.chatEnabledCheckbox, view.confirmChatExitCheckbox});
        break;
    default:
        break;
    }
    return scope;
}

Navigator::Scope BuildSoundPairScope(OptionsView& view, wxWindow* focused)
{
    const auto makeIfContains = [focused](std::initializer_list<wxWindow*> controls)
    {
        Navigator::Scope scope;
        scope.Add(controls);
        return Navigator::Contains(scope, focused) ? scope : Navigator::Scope{};
    };

    for (const auto& controls : {
             std::initializer_list<wxWindow*>{view.soundAmbienceCheckbox, view.soundMenuAmbienceSlider, view.soundTavernAmbienceSlider},
             std::initializer_list<wxWindow*>{view.soundAppLaunchCheckbox, view.soundAppLaunchSlider},
             std::initializer_list<wxWindow*>{view.soundNavigateCheckbox, view.soundNavigateSlider},
             std::initializer_list<wxWindow*>{view.soundSelectCheckbox, view.soundSelectSlider},
             std::initializer_list<wxWindow*>{view.soundChatMessagesCheckbox, view.soundChatMessagesSlider}})
    {
        Navigator::Scope scope = makeIfContains(controls);
        if (!scope.Empty())
        {
            return scope;
        }
    }
    return {};
}
}

OptionsFocusController::OptionsFocusController(OptionsView& view) noexcept : view_(view) {}

bool OptionsFocusController::FocusFirstSectionControl(std::size_t sectionIndex)
{
    return Navigator::FocusFirst(BuildSectionScope(view_, static_cast<int>(sectionIndex)));
}

void OptionsFocusController::BindNavigation(wxWindow& owner, std::function<bool()> isInsideSection)
{
    Navigator::BindTabNavigation(
        owner,
        [this]()
        {
            if (view_.sectionBook == nullptr || view_.sectionBook->GetSelection() != 1)
            {
                return Navigator::Scope{};
            }
            return BuildSoundPairScope(view_, wxWindow::FindFocus());
        },
        [isInsideSection]() { return !isInsideSection || isInsideSection(); });

    Navigator::BindVerticalNavigation(
        owner,
        [this]()
        {
            if (view_.sectionBook == nullptr)
            {
                return Navigator::Scope{};
            }
            return BuildSectionScope(view_, view_.sectionBook->GetSelection());
        },
        [isInsideSection]()
        {
            if (isInsideSection && !isInsideSection())
            {
                return false;
            }
            wxWindow* focused = wxWindow::FindFocus();
            return focused == nullptr || dynamic_cast<wxSlider*>(focused) == nullptr;
        },
        Navigator::Boundary::Clamp);
}

bool OptionsFocusController::FocusNextSectionControl()
{
    if (view_.sectionBook == nullptr)
    {
        return false;
    }
    Navigator::Scope section = BuildSectionScope(view_, view_.sectionBook->GetSelection());
    return Navigator::Move(section, Navigator::Direction::Forward, Navigator::Boundary::Clamp);
}

}
