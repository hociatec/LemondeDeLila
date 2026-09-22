#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::BeginRoomStart()
{
    if (!IsOpen() || roomStarted_ || roomStartPending_) return false;
    startConfigurationFlow_.Reset();
    roomStartFlowRequested_ = true;
    Show();
    if (state_.roomId <= 0)
    {
        UpdateStatus(wxString(L"Chargement de la configuration..."));
        if (GetParent()) GetParent()->Layout();
        return true;
    }
    if (!state_.system.setup.complete)
    {
        for (const auto& action : state_.actions)
        {
            if (action.disabled) continue;
            if (!application::GameActionPromptFactory::Build(
                    action, state_.actionCatalog))
                continue;
            PrepareAndExecuteAction(action);
            if (GetParent()) GetParent()->Layout();
            return true;
        }
    }
    if (!state_.system.setup.complete && ActivePrompt() != nullptr)
    {
        dismissedPromptActionType_.clear();
        submittedPromptActionType_.clear();
        SyncInlinePrompt();
        if (GetParent()) GetParent()->Layout();
        return true;
    }
    roomStartFlowRequested_ = false;
    roomStartPending_ = true;
    if (onRoomStartRequested_) onRoomStartRequested_();
    return true;
}

void GamePlayPanel::SetRoomStarted(bool started, int runId)
{
    const bool becameStarted = started && !roomStarted_;
    const bool becameSetup = !started && roomStarted_;
    roomStarted_ = started;
    if (started)
    {
        if (becameStarted)
        {
            const auto activeProjection = hasAuthoritativeState_ &&
                (state_.system.match.status == "started" ||
                 state_.system.match.status == "playing") &&
                (runId <= 0 || state_.runId <= 0 || state_.runId == runId);
            if (activeProjection)
            {
                // Game-state and room-state notifications are independent.
                // The active projection may arrive first; keeping it avoids
                // waiting forever for a second notification that will not
                // necessarily be emitted.
                awaitingStartedState_ = false;
                awaitingStartedRunId_ = 0;
            }
            else
            {
                // The room notification reaches the client before the game-state
                // projection for the new run. Do not let a rapid Enter (or any
                // game shortcut) execute against the preceding setup projection:
                // it has an obsolete version and can have no active turn yet.
                // ApplyState releases this lock when the authoritative started
                // projection arrives; F5 remains a recovery path if it is lost.
                awaitingStartedState_ = true;
                awaitingStartedRunId_ = runId;
                inputRequestSlot_.Cancel();
                inputSubmissionGuard_.Reset();
                retryableActionCommand_.reset();
                ClearView();
                UpdateStatus(wxString(L"Synchronisation de la partie..."));
                RequestRefresh();
            }
        }
        roomStartFlowRequested_ = false;
        roomStartPending_ = false;
        startConfigurationFlow_.Reset();
        // Setup already prepares the viewer's pawn choices. Reveal that
        // projection immediately when the room starts; the server rebases it
        // against its authoritative roster before accepting the command.
        pawnSelectionPanel_->Apply(pawnSelection_);
        SyncContentVisibility();
        if (becameStarted && state_.roomId <= 0) StartJoin();
    }
    else if (becameSetup)
    {
        awaitingStartedState_ = false;
        awaitingStartedRunId_ = 0;
        inputSubmissionGuard_.Reset();
        retryableActionCommand_.reset();
        roomStartFlowRequested_ = false;
        roomStartPending_ = false;
        startConfigurationFlow_.Reset();
        state_ = {};
        lines_.clear();
        pawnSelection_.reset();
        ClearView();
        RequestRefresh();
    }
    Show(roomStarted_ || roomStartFlowRequested_ || roomStartPending_);
    Layout();
    if (GetParent()) GetParent()->Layout();
    if (becameStarted && onZoneFocusRequested_) onZoneFocusRequested_();
}

void GamePlayPanel::ResetRoomSetup()
{
    roomStarted_ = false;
    awaitingStartedState_ = false;
    awaitingStartedRunId_ = 0;
    inputRequestSlot_.Cancel();
    inputSubmissionGuard_.Reset();
    retryableActionCommand_.reset();
    roomStartFlowRequested_ = false;
    roomStartPending_ = false;
    startConfigurationFlow_.Reset();
    state_ = {};
    lines_.clear();
    pawnSelection_.reset();
    ClearView();
    Hide();
    RequestRefresh();
    if (GetParent()) GetParent()->Layout();
}

void GamePlayPanel::NotifyRoomStartFailed(const wxString& message)
{
    if (roomStarted_) return;
    roomStartPending_ = false;
    roomStartFlowRequested_ = false;
    startConfigurationFlow_.Reset();
    submittedPromptActionType_.clear();
    dismissedPromptActionType_.clear();
    promptPanel_->HidePrompt(true);
    UpdateStatus(message, true, true);
    // A rejected room start belongs to the table view. Do not reveal the
    // gameplay panel again: pressing Enter must keep the user on the table
    // and its error message, instead of opening an unrelated game panel.
    Hide();
    if (GetParent()) GetParent()->Layout();
}
}
