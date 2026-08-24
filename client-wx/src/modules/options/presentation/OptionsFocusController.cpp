#include "modules/options/presentation/OptionsFocusController.h"

#include <wx/defs.h>
#include <wx/slider.h>
#include <wx/window.h>

#include "modules/options/presentation/OptionsView.h"
#include "shared/accessibility/FocusManager.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::options::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;
using FocusManager = lila::shared::accessibility::FocusManager;

Navigator::Scope BuildSectionScope(OptionsView& view, int sectionIndex)
{
    const auto general = view.GeneralControls();
    const auto audio = view.AudioControls();
    const auto chat = view.ChatControls();

    Navigator::Scope scope;
    switch (sectionIndex)
    {
    case 0:
        scope.Add({
            general.confirmExitCheckbox,
            general.restoreSessionCheckbox,
            general.showNavigationStatusCheckbox,
            general.enableBetaGamesCheckbox});
        break;
    case 1:
        scope.Add({
            audio.muteAllCheckbox,
            audio.soundAmbienceCheckbox,
            audio.soundMenuAmbienceSlider,
            audio.soundTavernAmbienceSlider,
            audio.soundAppLaunchCheckbox,
            audio.soundAppLaunchSlider,
            audio.soundNavigateCheckbox,
            audio.soundNavigateSlider,
            audio.soundSelectCheckbox,
            audio.soundSelectSlider,
            audio.soundChatMessagesCheckbox,
            audio.soundChatMessagesSlider});
        break;
    case 2:
        scope.Add({chat.chatEnabledCheckbox, chat.confirmChatExitCheckbox});
        break;
    default:
        break;
    }
    return scope;
}

Navigator::Scope BuildSoundPairScope(OptionsView& view, wxWindow* focused)
{
    const auto audio = view.AudioControls();
    const auto makeIfContains = [focused](std::initializer_list<wxWindow*> controls)
    {
        Navigator::Scope scope;
        scope.Add(controls);
        return Navigator::Contains(scope, focused) ? scope : Navigator::Scope{};
    };

    for (const auto& controls : {
             std::initializer_list<wxWindow*>{audio.soundAmbienceCheckbox, audio.soundMenuAmbienceSlider, audio.soundTavernAmbienceSlider},
             std::initializer_list<wxWindow*>{audio.soundAppLaunchCheckbox, audio.soundAppLaunchSlider},
             std::initializer_list<wxWindow*>{audio.soundNavigateCheckbox, audio.soundNavigateSlider},
             std::initializer_list<wxWindow*>{audio.soundSelectCheckbox, audio.soundSelectSlider},
             std::initializer_list<wxWindow*>{audio.soundChatMessagesCheckbox, audio.soundChatMessagesSlider}})
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

lila::shared::accessibility::FocusManager::Plan OptionsFocusController::BuildSectionMenuPlan(std::size_t sectionIndex)
{
    FocusManager::Plan plan;
    const auto shell = view_.Shell();
    if (shell.sectionsMenu == nullptr || shell.sectionsMenu->GetItemCount() == 0)
    {
        return plan;
    }

    shell.sectionsMenu->SetSelectedIndexSilently(sectionIndex);
    plan.AddWindow(shell.sectionsMenu->GetSelectedControl());
    return plan;
}

lila::shared::accessibility::FocusManager::Plan OptionsFocusController::BuildFirstSectionControlPlan(std::size_t sectionIndex)
{
    FocusManager::Plan plan;
    plan.AddScope([this, sectionIndex]() { return BuildSectionScope(view_, static_cast<int>(sectionIndex)); });
    return plan;
}

void OptionsFocusController::BindNavigation(wxWindow& owner, std::function<bool()> isInsideSection)
{
    Navigator::BindTabNavigation(
        owner,
        [this]()
        {
            const auto shell = view_.Shell();
            if (shell.sectionBook == nullptr || shell.sectionBook->GetSelection() != 1)
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
            const auto shell = view_.Shell();
            if (shell.sectionBook == nullptr)
            {
                return Navigator::Scope{};
            }
            return BuildSectionScope(view_, shell.sectionBook->GetSelection());
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
    const auto shell = view_.Shell();
    if (shell.sectionBook == nullptr)
    {
        return false;
    }
    Navigator::Scope section = BuildSectionScope(view_, shell.sectionBook->GetSelection());
    return Navigator::Move(section, Navigator::Direction::Forward, Navigator::Boundary::Clamp);
}
}
