#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include <wx/listbox.h>
#include <wx/rearrangectrl.h>
#include <wx/choice.h>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/session/application/GameSessionService.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/movement/presentation/GameMovementPanel.h"
#include "modules/gameplay/resources/presentation/GameResourcesPanel.h"
#include "modules/gameplay/workflows/presentation/GameWorkflowPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

namespace lila::modules::gameplay::presentation
{
GamePlayPanel::GamePlayPanel(
    wxWindow* parent,
    application::GameSessionService& service)
    : wxPanel(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxWANTS_CHARS),
      service_(service)
{
    BuildLayout();
    BindEvents();
}

GamePlayPanel::~GamePlayPanel()
{
    CloseSession();
}

void GamePlayPanel::Open(
    int roomId,
    std::string gameType,
    std::string gameName,
    bool roomStarted)
{
    if (roomId <= 0 || gameType.empty()) return;
    if (IsOpenFor(roomId, gameType)) return;
    CloseSession();
    AttachEventHandler();
    roomId_ = roomId;
    gameType_ = std::move(gameType);
    gameName_ = std::move(gameName);
    roomStarted_ = roomStarted;
    roomStartFlowRequested_ = false;
    roomStartPending_ = false;
    startConfigurationFlow_.Reset();
    ClearView();
    Show(roomStarted_);
    StartJoin();
}

void GamePlayPanel::CloseSession()
{
    requestSlot_.Cancel();
    inputRequestSlot_.Cancel();
    inputSubmissionGuard_.Reset();
    service_.ClearEventHandler();
    service_.Close();
    roomId_ = 0;
    gameType_.clear();
    gameName_.clear();
    state_ = {};
    roomStarted_ = true;
    roomStartFlowRequested_ = false;
    roomStartPending_ = false;
    startConfigurationFlow_.Reset();
    ClearView();
}

bool GamePlayPanel::IsOpenFor(int roomId, const std::string& gameType) const
{
    return roomId_ == roomId && gameType_ == gameType;
}

bool GamePlayPanel::IsOpen() const noexcept
{
    return roomId_ > 0 && !gameType_.empty();
}

bool GamePlayPanel::IsFinished() const noexcept
{
    return state_.system.match.status == "finished";
}

void GamePlayPanel::SetZoneFocusRequestedHandler(ZoneFocusRequestedHandler handler)
{
    onZoneFocusRequested_ = std::move(handler);
}

void GamePlayPanel::SetHistoryMessageHandler(HistoryMessageHandler handler)
{
    onHistoryMessage_ = std::move(handler);
}

void GamePlayPanel::SetTableShortcutHandler(TableShortcutHandler handler)
{
    onTableShortcut_ = std::move(handler);
}

void GamePlayPanel::SetGameSoundEventHandler(GameSoundEventHandler handler)
{
    onGameSoundEvent_ = std::move(handler);
}

void GamePlayPanel::SetRoomStartRequestedHandler(RoomStartRequestedHandler handler)
{
    onRoomStartRequested_ = std::move(handler);
}

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
    if (!state_.system.setup.complete && state_.prompt)
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
    roomStarted_ = started;
    if (started)
    {
        roomStartFlowRequested_ = false;
        roomStartPending_ = false;
        startConfigurationFlow_.Reset();
    }
    Show(roomStarted_ || roomStartFlowRequested_ || roomStartPending_);
    if (becameStarted && onZoneFocusRequested_) onZoneFocusRequested_();
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

wxWindow* GamePlayPanel::PreferredNavigationTarget() const
{
    if (confirmationPanel_ != nullptr && confirmationPanel_->IsActive())
    {
        const auto targets = confirmationPanel_->TabTargets();
        if (!targets.empty()) return targets.front();
    }
    if (promptPanel_ != nullptr && promptPanel_->IsActive())
    {
        const auto targets = promptPanel_->TabTargets();
        if (!targets.empty()) return targets.front();
    }
    // State received during start-up may already expose a hand. Until the room
    // is confirmed started, keep RoomPanel's game-zone anchor as the target so
    // the transient hand cannot become a keyboard trap.
    if (!roomStarted_) return nullptr;
    if (pawnSelectionPanel_ != nullptr)
    {
        if (auto* target = pawnSelectionPanel_->NavigationTarget()) return target;
    }
    if (handPanel_ != nullptr)
    {
        if (auto* target = handPanel_->NavigationTarget()) return target;
    }
    if (dicePanel_ != nullptr)
    {
        if (auto* target = dicePanel_->NavigationTarget()) return target;
    }
    if (gridPanel_ != nullptr)
    {
        if (auto* target = gridPanel_->NavigationTarget(); target && gridPanel_->IsShown())
            return target;
    }
    if (movementPanel_ != nullptr)
        if (auto* target = movementPanel_->NavigationTarget()) return target;
    if (resourcesPanel_ != nullptr)
        if (auto* target = resourcesPanel_->NavigationTarget()) return target;
    if (workflowPanel_ != nullptr)
        if (auto* target = workflowPanel_->NavigationTarget()) return target;
    if (choicesList_ != nullptr && choicesList_->IsShown() && choicesList_->GetCount() > 0)
        return choicesList_;
    if (orderingChoices_ != nullptr && orderingChoices_->IsShown())
        return orderingChoices_;
    if (linesList_ != nullptr && linesList_->IsShown() && linesList_->GetCount() > 0)
        return linesList_;
    if (infoPanelChoice_ != nullptr && infoPanelChoice_->IsShown() &&
        infoPanelChoice_->GetCount() > 0) return infoPanelChoice_;
    return nullptr;
}
}
