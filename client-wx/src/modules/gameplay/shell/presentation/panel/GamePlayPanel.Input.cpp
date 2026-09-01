#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/choice.h>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/dice/application/GameDiceActionResolver.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"
#include "modules/gameplay/shortcuts/application/GameGenericShortcutPolicy.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::HandleKey(wxKeyEvent& event)
{
    const int keyCode = event.GetKeyCode();

    // A CHAR_HOOK is delivered before the top-level window sees the key. Never
    // consume the operating-system close shortcut, including while a modal game
    // control or a room-start transition owns the gameplay focus.
    if (event.AltDown() && keyCode == WXK_F4) return false;
    if (!IsOpen()) return false;
    if (IsFinished()) return false;

    if (IsConfirmationVisible())
    {
        return confirmationPanel_->HandleKey(event);
    }
    if (IsInlinePromptVisible())
    {
        return promptPanel_->HandleKey(event);
    }
    if (pawnSelectionPanel_->IsActive())
    {
        return pawnSelectionPanel_->HandleKey(event);
    }

    // Tab belongs to RoomPanel's two-zone navigation. Handling it here would
    // trap the keyboard inside the hand because this panel uses CHAR_HOOK.
    if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB) return false;
    if (gridPanel_->HandleKey(event)) return true;

    const bool tableShortcutHasPriority =
        event.ControlDown() || event.AltDown() || event.MetaDown() ||
        keyCode == 'B' || keyCode == 'b' || keyCode == 'W' || keyCode == 'w' ||
        keyCode == 'I' || keyCode == 'i' || keyCode == 'R' || keyCode == 'r' ||
        keyCode == 'Q' || keyCode == 'q' || keyCode == 'X' || keyCode == 'x';
    if (tableShortcutHasPriority && onTableShortcut_ && onTableShortcut_(event)) return true;

    const auto key = NormalizeKey(event);
    if (key.empty())
    {
        return false;
    }

    if (event.IsAutoRepeat() && key != "F5") return true;

    // Read-only information remains available while the room and the first
    // projected game state finish their startup handshake.
    const auto genericPanel =
        application::shortcuts::GameGenericShortcutPolicy::ResolveInterface(state_, key);
    if (!genericPanel.empty())
    {
        SelectInfoPanel(genericPanel, true);
        return true;
    }

    // Before the room starts, Enter must reach the room activation path so it
    // can either start or announce the server-provided participant constraint.
    const bool gameStateStarted =
        (state_.system.match.status == "started" ||
         state_.system.match.status == "playing") && state_.system.setup.complete;
    if (!roomStarted_ && !gameStateStarted) return false;

    if (key == "ENTER")
    {
        // Match WPF: the visible hand/choice owns Enter even when focus still
        // sits on the stable game-zone anchor.
        if (handPanel_->IsShown() && !state_.kits.VisibleHand().empty())
        {
            static_cast<void>(ActivateSelectedHandCard());
            return true;
        }
        if (choicesList_->IsShown() && choicesList_->GetCount() > 0)
        {
            static_cast<void>(ActivateSelectedPendingChoice());
            return true;
        }
        auto* focused = wxWindow::FindFocus();
        if (focused == infoPanelChoice_) return false;
        if (focused == dicePanel_->NavigationTarget())
        {
            static_cast<void>(ActivateSelectedDie());
            return true;
        }
        if (focused == gridPanel_->NavigationTarget())
        {
            static_cast<void>(ActivateSelectedGridCell());
            return true;
        }
        if (focused == linesList_ && linesList_->IsShown())
        {
            ActivateSelectedLine();
            return true;
        }
        if (const auto* prompt = ActivePrompt();
            prompt && submittedPromptActionType_ == prompt->actionType)
            return true;
        SendKey(key);
        return true;
    }
    if (key == "F5")
    {
        RequestRefresh();
        return true;
    }
    if (HandleShortcut(key)) return true;
    // An unconfigured key is deliberately silent and must not create a
    // protocol request or a generic server error.
    return true;
}

void GamePlayPanel::ActivateSelectedLine()
{
    const int selection = linesList_->GetSelection();
    if (selection == wxNOT_FOUND || selection < 0 ||
        static_cast<std::size_t>(selection) >= lines_.size())
    {
        UpdateStatus(wxString(L"Aucune ligne sélectionnée."), true, true);
        return;
    }
    const auto& line = lines_[static_cast<std::size_t>(selection)];
    if (!line.enabled || line.actionIndex == domain::GameLine::NoAction ||
        line.actionIndex >= state_.actions.size())
    {
        activeInfoPanel_ = "details";
        UpdateInfoPanel();
        UpdateStatus(wxString(L"Ligne informative."), false, true);
        return;
    }
    PrepareAndExecuteAction(state_.actions[line.actionIndex]);
}

bool GamePlayPanel::HandleShortcut(const std::string& normalizedKey)
{
    const auto* found = shortcuts::GameShortcutResolver::Find(
        state_, lines_, normalizedKey);
    if (found == nullptr)
    {
        lila::shared::logging::LogInfo(
            "GameInput", "No server shortcut for key=" + normalizedKey);
        return false;
    }
    if (found->kind == domain::GameShortcutKind::Interface)
    {
        return HandleInterfaceShortcut(found->id);
    }
    if (found->kind == domain::GameShortcutKind::Action)
    {
        auto action = ResolveShortcutAction(found->actionType);
        if (!action)
        {
            lila::shared::logging::LogWarning(
                "GameInput", "Shortcut action is unavailable for key=" + normalizedKey);
            return true;
        }
        lila::shared::logging::LogInfo(
            "GameInput", "Shortcut action resolved: key=" + normalizedKey +
                ", type=" + action->type);
        PrepareAndExecuteAction(std::move(*action));
        return true;
    }
    return false;
}

bool GamePlayPanel::HandleInterfaceShortcut(const std::string& id)
{
    if (id.empty()) return false;
    SelectInfoPanel(id, true);
    return true;
}

std::optional<domain::GameAction> GamePlayPanel::ResolveShortcutAction(const std::string& actionType) const
{
    return shortcuts::GameShortcutResolver::ResolveAction(
        state_, lines_, actionType, linesList_->GetSelection());
}

std::string GamePlayPanel::NormalizeKey(const wxKeyEvent& event) const
{
    return shortcuts::GameShortcutResolver::NormalizeKey(event);
}
}
