#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/scrolwin.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/application/GameGridActionResolver.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/session/application/GameSessionService.h"
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
    linesList_->Bind(wxEVT_LISTBOX_DCLICK, [this](wxCommandEvent&) { ActivateSelectedLine(); });
    handPanel_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&) { static_cast<void>(ActivateSelectedHandCard()); });
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
    promptPanel_->SetCandidatesRequestHandler(
        [this](domain::GameActionCandidatesRequest request)
        {
            auto* service = &service_;
            RunCommand(
                [service, request = std::move(request)](std::stop_token stopToken)
                {
                    service->RequestActionCandidates(request, stopToken);
                },
                "Chargement des candidats impossible.",
                [](GamePlayPanel& panel, const lila::shared::errors::AppError&)
                {
                    panel.promptPanel_->RejectCandidatesRequest();
                });
        });
    promptPanel_->SetStartAmbienceInteractionHandler(
        [this](std::string soundId, int volumeDelta)
        {
            if (volumeDelta == 0)
            {
                if (onStartAmbiencePreview_) onStartAmbiencePreview_(std::move(soundId));
                return;
            }
            if (onStartAmbienceVolume_) onStartAmbienceVolume_(volumeDelta);
        });
    promptPanel_->SetSubmitHandler(
        [this](domain::GameAction action)
        {
            if (!lifecycle_.IsRoomStarted() && lifecycle_.IsStartFlowRequested() &&
                action.payload.contains("__tableAmbienceSoundId"))
            {
                const auto& value = action.payload["__tableAmbienceSoundId"];
                if (onStartAmbienceSelected_)
                {
                    const auto* soundId = value.Text();
                    onStartAmbienceSelected_(soundId == nullptr ? std::string{} : *soundId);
                }
                action.payload.erase("__tableAmbienceSoundId");
                if (onStartAmbiencePreview_) onStartAmbiencePreview_({});
                promptPanel_->ClearStartAmbiences();
            }
            if (!lifecycle_.IsRoomStarted() && action.type == "__room-start__")
            {
                lifecycle_.MarkRoomStartPending();
                if (onRoomStartRequested_) onRoomStartRequested_();
                return;
            }
            submittedPromptActionType_ = action.type;
            dismissedPromptActionType_.clear();
            const bool startsRoomAfterSubmission = !lifecycle_.IsRoomStarted() &&
                lifecycle_.IsStartFlowRequested() &&
                !state_.system.setup.complete;
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
            if (onStartAmbiencePreview_) onStartAmbiencePreview_({});
            if (const auto* prompt = ActivePrompt())
                dismissedPromptActionType_ = prompt->actionType;
            lifecycle_.StartFailed();
            startConfigurationFlow_.Reset();
            Show(lifecycle_.IsVisible());
            if (GetParent()) GetParent()->Layout();
            if (onZoneFocusRequested_) onZoneFocusRequested_();
        });
}
bool GamePlayPanel::HandleZoneActivation()
{
    if (!IsOpen()) return false;
    if (!lifecycle_.HasAuthoritativeState()) return true;
    if (!lifecycle_.IsRoomStarted())
        return lifecycle_.IsStartFlowRequested() || lifecycle_.IsRoomStartPending();
    if (IsFinished()) return false;
    if (IsConfirmationVisible() || IsInlinePromptVisible()) return true;
    if (const auto* prompt = ActivePrompt())
    {
        if (submittedPromptActionType_ != prompt->actionType)
        {
            dismissedPromptActionType_.clear();
            SyncInlinePrompt();
            return true;
        }
        return true;
    }
    // A started game may temporarily have no actionable control: for example
    // just after an answer has been sent, while another player is choosing,
    // or while the next state is arriving.  The room's zone anchor used to
    // treat an unhandled Enter in that interval as its default table action
    // (Start).  That submitted a second start command to an already running
    // game, produced "Cette action n'est pas disponible", and could strand
    // keyboard users outside the game workflow.  Once this panel owns an
    // open, started room, Enter belongs to the game zone even when it has
    // nothing to activate yet.
    return true;
}

bool GamePlayPanel::ActivateSelectedHandCard()
{
    const auto& hand = state_.kits.VisibleHand();
    const auto key = handPanel_->SelectedCardKey();
    if (key.empty())
    {
        lila::shared::logging::LogWarning("GameInput", "Card activation has no selection.");
        return false;
    }
    const auto selected = std::find_if(hand.begin(), hand.end(), [&key](const auto& card)
    { return card.id == key; });
    if (selected == hand.end()) return false;
    if (selected->disabled)
    {
        UpdateStatus(
            wxString(L"Cette carte ne peut pas être jouée maintenant."),
            true,
            true);
        return true;
    }
    auto action = application::cards::GameCardActionResolver::Resolve(
        hand, state_.actions, static_cast<std::size_t>(selected - hand.begin()));
    if (!action)
    {
        lila::shared::logging::LogWarning(
            "GameInput", "Card activation has no server-provided action.");
        UpdateStatus(
            wxString(L"Cette carte ne peut pas être jouée maintenant."),
            true,
            true);
        return true;
    }
    lila::shared::logging::LogInfo(
        "GameInput", "Card action resolved: " + action->type);
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
        lila::shared::logging::LogWarning(
            "GameInput", "Grid activation has no server-provided action.");
        return true;
    }
    PrepareAndExecuteAction(*action);
    return true;
}
}
