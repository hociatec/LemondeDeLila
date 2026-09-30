#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"
#include "shared/accessibility/presentation/NavigationController.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::BeginRoomStart()
{
    if (!IsOpen() || !lifecycle_.BeginRoomStart()) return false;
    startConfigurationFlow_.Reset();
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
    // Even games without server-side options use the same configuration
    // panel so the table ambience is always chosen before Start.
    domain::GamePrompt prompt;
    prompt.title = "Configuration de démarrage";
    prompt.actionType = "__room-start__";
    domain::GameAction action;
    action.type = prompt.actionType;
    static_cast<void>(promptPanel_->ShowPrompt(prompt, std::move(action)));
    if (GetParent()) GetParent()->Layout();
    CallAfter([this]()
    {
        const auto targets = promptPanel_->TabTargets();
        if (!targets.empty())
            static_cast<void>(lila::shared::accessibility::NavigationController::Focus(targets.front()));
    });
    return true;
}

void GamePlayPanel::SetRoomStarted(bool started, int runId)
{
    const bool becameStarted = started && !lifecycle_.IsRoomStarted();
    const bool becameSetup = !started && lifecycle_.IsRoomStarted();
    if (started)
    {
        bool activeProjection = false;
        if (becameStarted)
        {
            activeProjection = lifecycle_.HasAuthoritativeState() &&
                (state_.system.match.status == "started" ||
                 state_.system.match.status == "playing") &&
                (runId <= 0 || state_.runId <= 0 || state_.runId == runId);
            if (!activeProjection)
            {
                // The room notification reaches the client before the game-state
                // projection for the new run. Do not let a rapid Enter (or any
                // game shortcut) execute against the preceding setup projection:
                // it has an obsolete version and can have no active turn yet.
                // ApplyState releases this lock when the authoritative started
                // projection arrives; F5 remains a recovery path if it is lost.
                inputRequestSlot_.Cancel();
                inputSubmissionGuard_.Reset();
                retryableActionCommand_.reset();
                ClearView();
                UpdateStatus(wxString(L"Synchronisation de la partie..."));
                RequestRefresh();
            }
        }
        lifecycle_.SetRoomStarted(true, activeProjection || !becameStarted, runId);
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
        lifecycle_.SetRoomStarted(false, false, 0);
        inputSubmissionGuard_.Reset();
        retryableActionCommand_.reset();
        startConfigurationFlow_.Reset();
        state_ = {};
        lines_.clear();
        pawnSelection_.reset();
        ClearView();
        RequestRefresh();
    }
    Show(lifecycle_.IsVisible());
    Layout();
    if (GetParent()) GetParent()->Layout();
    if (becameStarted && onZoneFocusRequested_) onZoneFocusRequested_();
}

void GamePlayPanel::ResetRoomSetup()
{
    lifecycle_.SetRoomStarted(false, false, 0);
    inputRequestSlot_.Cancel();
    inputSubmissionGuard_.Reset();
    retryableActionCommand_.reset();
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
    if (lifecycle_.IsRoomStarted()) return;
    lifecycle_.StartFailed();
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
