#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"

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

void GamePlayPanel::SetRoomStarted(bool started)
{
    const bool becameStarted = started && !roomStarted_;
    const bool becameSetup = !started && roomStarted_;
    roomStarted_ = started;
    if (started)
    {
        roomStartFlowRequested_ = false;
        roomStartPending_ = false;
        startConfigurationFlow_.Reset();
        pawnSelectionPanel_->Apply(pawnSelection_);
        SyncContentVisibility();
    }
    else if (becameSetup)
    {
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
    if (becameStarted && onZoneFocusRequested_) onZoneFocusRequested_();
}

void GamePlayPanel::ResetRoomSetup()
{
    roomStarted_ = false;
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
    roomStartFlowRequested_ = true;
    startConfigurationFlow_.Reset();
    submittedPromptActionType_.clear();
    UpdateStatus(message, true, true);
    SyncInlinePrompt();
    Show();
    if (GetParent()) GetParent()->Layout();
}
}
