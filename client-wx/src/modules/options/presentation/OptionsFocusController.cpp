#include "modules/options/presentation/OptionsFocusController.h"

#include <wx/defs.h>
#include <wx/notebook.h>
#include <wx/window.h>

#include "modules/options/presentation/OptionsView.h"
#include "shared/accessibility/application/FocusManager.h"
#include "shared/accessibility/application/NavigationController.h"

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
            general.repairBrokenAccentsCheckbox,
            general.enableBetaGamesCheckbox,
            general.saveButton});
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
            audio.soundChatMessagesSlider,
            audio.soundTableAmbienceCheckbox,
            audio.soundTableAmbienceSlider,
            audio.detailedSoundChoice,
            audio.detailedSoundEnabledCheckbox,
            audio.detailedSoundVolumeSlider,
            audio.saveButton});
        break;
    case 2:
        scope.Add({chat.chatEnabledCheckbox, chat.confirmChatExitCheckbox, chat.saveButton});
        break;
    default:
        break;
    }
    return scope;
}

Navigator::Scope BuildOptionsScope(OptionsView& view)
{
    const auto shell = view.Shell();
    Navigator::Scope scope;
    scope.Add(shell.sectionBook);
    if (shell.sectionBook != nullptr)
    {
        const Navigator::Scope section = BuildSectionScope(view, shell.sectionBook->GetSelection());
        for (wxWindow* control : Navigator::Resolve(section))
        {
            scope.Add(control);
        }
    }
    scope.Add(shell.cancelButton);
    return scope;
}

bool IsPreviousTabKey(int keyCode) noexcept
{
    return keyCode == WXK_LEFT || keyCode == WXK_NUMPAD_LEFT;
}

bool IsNextTabKey(int keyCode) noexcept
{
    return keyCode == WXK_RIGHT || keyCode == WXK_NUMPAD_RIGHT;
}

bool IsVerticalArrowKey(int keyCode) noexcept
{
    return keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP ||
        keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN;
}

}

OptionsFocusController::OptionsFocusController(OptionsView& view) noexcept : view_(view) {}

lila::shared::accessibility::FocusManager::Plan OptionsFocusController::BuildSectionTabsPlan()
{
    FocusManager::Plan plan;
    const auto shell = view_.Shell();
    if (shell.sectionBook == nullptr || shell.sectionBook->GetPageCount() == 0)
    {
        return plan;
    }

    plan.AddWindow(shell.sectionBook);
    return plan;
}

void OptionsFocusController::BindNavigation(wxWindow& owner)
{
    Navigator::BindTabNavigation(
        owner,
        [this]()
        {
            return BuildOptionsScope(view_);
        },
        {},
        Navigator::Boundary::Wrap);

    owner.Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            const auto shell = view_.Shell();
            wxNotebook* book = shell.sectionBook;
            if (book == nullptr || wxWindow::FindFocus() != book)
            {
                event.Skip();
                return;
            }

            const int keyCode = event.GetKeyCode();
            if (IsVerticalArrowKey(keyCode))
            {
                event.Skip(false);
                return;
            }
            if (!IsPreviousTabKey(keyCode) && !IsNextTabKey(keyCode))
            {
                event.Skip();
                return;
            }

            const int pageCount = book->GetPageCount();
            const int current = book->GetSelection();
            if (pageCount <= 0 || current == wxNOT_FOUND)
            {
                event.Skip(false);
                return;
            }

            const int delta = IsPreviousTabKey(keyCode) ? -1 : 1;
            const int target = current + delta;
            if (target >= 0 && target < pageCount)
            {
                book->SetSelection(target);
                book->SetFocus();
            }
            event.Skip(false);
        });
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
