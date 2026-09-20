#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/choice.h>
#include <wx/choicdlg.h>
#include <wx/button.h>
#include "modules/gameplay/grid/application/GameGridCoordinate.h"
#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"
#include "modules/gameplay/workflows/presentation/GameWorkflowPanel.h"
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
    const auto key = NormalizeKey(event);
    if (key.empty()) return false;

    // These read-only shortcuts must stay available even while the table is
    // waiting for its first started game state.
    const auto genericPanel =
        application::shortcuts::GameGenericShortcutPolicy::ResolveInterface(state_, key);
    if (!genericPanel.empty())
    {
        const auto message = application::info::GameCapabilityTextBuilder::Build(
            state_, genericPanel);
        if (!message.empty()) UpdateStatus(FromUtf8(message), false, true);
        return true;
    }
    // A projected game state can already contain the next run's pawn choice
    // while the room is still in setup. Until the room confirms its start,
    // Enter belongs exclusively to the stable room game-zone activation.
    if (!roomStarted_)
    {
        if (keyCode == WXK_SPACE || keyCode == WXK_NUMPAD_SPACE)
            return BeginRoomStart();
        return false;
    }
    if (awaitingStartedState_)
    {
        // Consume all gameplay keys while the room has started but the game
        // socket still holds the preceding setup projection. F5 remains an
        // explicit recovery path if a state notification was lost.
        if (keyCode == WXK_F5)
        {
            RequestRefresh();
            return true;
        }
        return true;
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
        keyCode == 'R' || keyCode == 'r' ||
        keyCode == 'Q' || keyCode == 'q' || keyCode == 'X' || keyCode == 'x';
    if (tableShortcutHasPriority && onTableShortcut_ && onTableShortcut_(event)) return true;

    if (event.IsAutoRepeat() && key != "F5") return true;

    if (key == "ENTER")
    {
        // Enter activates only the control that actually owns focus. It must
        // never fall through to an arbitrary visible list.
        auto* focused = wxWindow::FindFocus();
        if (handPanel_->IsShown() && focused == handPanel_->NavigationTarget())
            return ActivateSelectedHandCard();
        if (choicesList_->IsShown() && focused == choicesList_)
            return ActivateSelectedPendingChoice();
        if (focused == workflowPanel_->NavigationTarget())
            return ActivateSelectedQuizAnswer();
        if (focused == gridPanel_->NavigationTarget())
            return ActivateSelectedGridCell();
        if (focused == linesList_ && linesList_->IsShown())
        {
            ActivateSelectedLine();
            return true;
        }
        // The dice control is the default action of the gameplay zone when no
        // selectable list owns Enter. For other games, leave Enter available
        // to the stable room anchor so it can deliberately open the detailed
        // hand, grid or action interface. Space is never routed here.
        if (ActivateDiceRoll()) return true;
        return false;
    }
    if (key == "F5")
    {
        RequestRefresh();
        return true;
    }
    if (HandleShortcut(key)) return true;
    // A game may reserve I for its own inventory. Without such a declaration,
    // let RoomPanel keep its usual information shortcut.
    if (key == "I") return false;
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
        if (action->payload.contains("orientation"))
        {
            std::vector<domain::GameAction> candidates;
            wxArrayString labels;
            for (const auto& candidate : state_.actions)
            {
                if (candidate.disabled || candidate.type != action->type) continue;
                const auto& payload = candidate.payload;
                if (!payload.contains("x") || !payload["x"].is_number_integer() ||
                    !payload.contains("y") || !payload["y"].is_number_integer() ||
                    !payload.contains("orientation") || !payload["orientation"].is_string()) continue;
                const auto orientation = payload["orientation"].get<std::string>();
                if (orientation != "h" && orientation != "v") continue;
                const auto coordinate = application::grid::GridCoordinate(
                    payload["x"].get<int>(), payload["y"].get<int>());
                labels.Add(lila::shared::text::FromUtf8("Mur " + std::string(
                    orientation == "h" ? "horizontal sous " : "vertical à droite de ") + coordinate));
                candidates.push_back(candidate);
            }
            if (candidates.empty()) return true;
            const auto version = state_.version;
            const auto run = state_.runId;
            wxSingleChoiceDialog dialog(this, L"Choisissez un emplacement et une orientation.",
                L"Poser un mur", labels);
            if (auto* button = wxDynamicCast(dialog.FindWindow(wxID_OK), wxButton)) button->SetLabel(L"Poser");
            if (auto* button = wxDynamicCast(dialog.FindWindow(wxID_CANCEL), wxButton)) button->SetLabel(L"Annuler");
            if (dialog.ShowModal() != wxID_OK) return true;
            if (version != state_.version || run != state_.runId)
            {
                UpdateStatus(L"Le plateau a changé. Choisissez de nouveau votre mur.", true, true);
                return true;
            }
            const auto selection = dialog.GetSelection();
            if (selection < 0 || static_cast<std::size_t>(selection) >= candidates.size()) return true;
            action = candidates[static_cast<std::size_t>(selection)];
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
    static_cast<void>(id);
    return false;
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
