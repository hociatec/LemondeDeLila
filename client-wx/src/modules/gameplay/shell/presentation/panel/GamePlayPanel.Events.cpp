#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/choice.h>
#include <wx/listbox.h>
#include <wx/scrolwin.h>
#include <wx/textctrl.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/dice/application/GameDiceActionResolver.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/application/GameGridActionResolver.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::BindEvents()
{
    Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            if (!HandleKey(event)) event.Skip();
        });
    linesList_->Bind(wxEVT_LISTBOX, [this](wxCommandEvent&) { UpdateInfoPanel(); });
    infoPanelChoice_->Bind(wxEVT_CHOICE, [this](wxCommandEvent&)
    {
        const int selected = infoPanelChoice_->GetSelection();
        if (selected >= 0 && static_cast<std::size_t>(selected) < infoPanelIds_.size())
            SelectInfoPanel(infoPanelIds_[static_cast<std::size_t>(selected)], true);
    });
    linesList_->Bind(wxEVT_LISTBOX_DCLICK, [this](wxCommandEvent&) { ActivateSelectedLine(); });
    handPanel_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&) { static_cast<void>(ActivateSelectedHandCard()); });
    dicePanel_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&) { static_cast<void>(ActivateSelectedDie()); });
    gridPanel_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&) { static_cast<void>(ActivateSelectedGridCell()); });
    choicesList_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&) { static_cast<void>(ActivateSelectedPendingChoice()); });
    promptPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            static_cast<void>(visible);
            SyncContentVisibility();
        });
    confirmationPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            static_cast<void>(visible);
            SyncContentVisibility();
        });
    pawnSelectionPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            static_cast<void>(visible);
            SyncContentVisibility();
        });
    pawnSelectionPanel_->SetSubmitHandler(
        [this](domain::GameAction action)
        {
            ExecuteAction(std::move(action));
        });
    confirmationPanel_->SetConfirmedHandler(
        [this](domain::GameAction action)
        {
            PrepareAndExecuteAction(std::move(action));
        });
    promptPanel_->SetValidationErrorHandler(
        [this](const wxString& message, wxWindow*)
        {
            UpdateStatus(message, true, true);
        });
    promptPanel_->SetSubmitHandler(
        [this](domain::GameAction action)
        {
            submittedPromptActionType_ = action.type;
            dismissedPromptActionType_.clear();
            const bool startsRoomAfterSubmission = !roomStarted_ && roomStartFlowRequested_ &&
                !state_.system.setup.complete && state_.prompt &&
                state_.prompt->actionType == action.type;
            if (startsRoomAfterSubmission &&
                !startConfigurationFlow_.TryBeginSubmission(state_.system.setup))
                return;
            ExecuteAction(std::move(action));
            if (!startsRoomAfterSubmission && onZoneFocusRequested_)
                onZoneFocusRequested_();
        });
    promptPanel_->SetCancelHandler(
        [this](std::string)
        {
            if (state_.prompt) dismissedPromptActionType_ = state_.prompt->actionType;
            roomStartFlowRequested_ = false;
            roomStartPending_ = false;
            startConfigurationFlow_.Reset();
            Show(roomStarted_);
            if (GetParent()) GetParent()->Layout();
            if (onZoneFocusRequested_) onZoneFocusRequested_();
        });
}
bool GamePlayPanel::HandleZoneActivation()
{
    if (!IsOpen()) return false;
    if (!roomStarted_)
        return roomStartFlowRequested_ || roomStartPending_;
    if (IsFinished())
    {
        SendKey("ENTER");
        return true;
    }
    if (IsConfirmationVisible() || IsInlinePromptVisible()) return true;
    if (pawnSelectionPanel_->IsActive()) return true;
    if (state_.prompt)
    {
        if (submittedPromptActionType_ != state_.prompt->actionType)
        {
            dismissedPromptActionType_.clear();
            SyncInlinePrompt();
            return true;
        }
        return true;
    }
    return false;
}

bool GamePlayPanel::ActivateSelectedHandCard()
{
    const auto& hand = state_.kits.VisibleHand();
    const int selected = handPanel_->SelectedIndex();
    if (selected < 0)
    {
        lila::shared::logging::LogWarning("GameInput", "Card activation has no selection.");
        return false;
    }
    if (static_cast<std::size_t>(selected) >= hand.size()) return false;
    if (hand[static_cast<std::size_t>(selected)].disabled)
    {
        // WPF consumes Enter silently on an unplayable card: it must not fall
        // through to a global ENTER shortcut or announce a misleading error.
        return true;
    }
    auto action = application::cards::GameCardActionResolver::Resolve(
        hand, state_.actions, static_cast<std::size_t>(selected));
    if (!action)
    {
        lila::shared::logging::LogWarning(
            "GameInput", "Card activation has no server-provided action.");
        UpdateStatus(wxString(L"Cette carte ne peut pas \u00EAtre jou\u00E9e."), true, true);
        return true;
    }
    lila::shared::logging::LogInfo(
        "GameInput", "Card action resolved: " + action->type);
    PrepareAndExecuteAction(std::move(*action));
    return true;
}

bool GamePlayPanel::ActivateSelectedDie()
{
    const auto* dice = state_.kits.Dice();
    if (dice == nullptr) return false;
    const int selected = dicePanel_->SelectedIndex();
    const auto index = selected >= 0 ? static_cast<std::size_t>(selected) : std::size_t{0};
    auto action = application::dice::GameDiceActionResolver::Resolve(
        *dice, state_.actions, index);
    if (!action) return false;
    PrepareAndExecuteAction(std::move(*action));
    return true;
}

bool GamePlayPanel::ActivateSelectedGridCell()
{
    const auto cellId = gridPanel_->SelectedCellId();
    const auto boardId = gridPanel_->SelectedBoardId();
    if (cellId.empty()) return false;
    const auto action = application::grid::GameGridActionResolver::Resolve(
        state_.actions,
        {boardId, cellId, gridPanel_->SelectedX(), gridPanel_->SelectedY()});
    if (!action)
    {
        UpdateStatus(wxString(L"Aucune action disponible pour cette case."), false, true);
        return true;
    }
    PrepareAndExecuteAction(*action);
    return true;
}
}
