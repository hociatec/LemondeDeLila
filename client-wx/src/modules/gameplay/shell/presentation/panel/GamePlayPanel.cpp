#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include <wx/listbox.h>
#include <wx/rearrangectrl.h>
#include <wx/choice.h>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
#include "modules/gameplay/session/application/GameSessionService.h"
#include "modules/gameplay/shell/application/GamePlayAccessPolicy.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/movement/presentation/GameMovementPanel.h"
#include "modules/gameplay/workflows/presentation/GameWorkflowPanel.h"
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
    dicePanel_->SetActivateHandler(
        [this](domain::GameAction action)
        {
            PrepareAndExecuteAction(std::move(action));
        });
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
    // The transport transition belongs to GameSessionService::Join, which is
    // already executed by StartJoin on a background worker. Only reset the
    // presentation here so opening a room can never wait on WinHTTP on the UI.
    ResetSessionState();
    AttachEventHandler();
    roomId_ = roomId;
    gameType_ = std::move(gameType);
    gameName_ = std::move(gameName);
    lifecycle_.Open(roomStarted);
    startConfigurationFlow_.Reset();
    Show(lifecycle_.IsVisible());
    StartJoin();
}

void GamePlayPanel::CloseSession()
{
    ResetSessionState();
    service_.Close();
}

void GamePlayPanel::ResetSessionState()
{
    eventMailbox_.Clear();
    joinRequestSlot_.Cancel();
    refreshRequestSlot_.Cancel();
    rulesRequestSlot_.Cancel();
    candidatesRequestSlot_.Cancel();
    inputRequestSlot_.Cancel();
    inputSubmissionGuard_.Reset();
    retryableActionCommand_.reset();
    service_.ClearEventHandler();
    roomId_ = 0;
    gameType_.clear();
    gameName_.clear();
    state_ = {};
    lines_.clear();
    lifecycle_.Close();
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
    return state_.system.match.status == domain::GameMatchStatus::Finished;
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

bool GamePlayPanel::IsUsableNavigationTarget(wxWindow* target)
{
    return target != nullptr && application::GamePlayAccessPolicy::IsUsableTarget(
        target->IsShownOnScreen(), target->IsEnabled(), target->AcceptsFocus());
}

wxWindow* GamePlayPanel::PreferredNavigationTarget() const
{
    return ResolveUsableNavigationTarget(false);
}

wxWindow* GamePlayPanel::RequiredInteractionTarget() const
{
    return ResolveUsableNavigationTarget(true);
}

wxWindow* GamePlayPanel::ResolveUsableNavigationTarget(bool requiredOnly) const
{
    const auto usable = [](wxWindow* target) -> wxWindow*
    {
        return IsUsableNavigationTarget(target) ? target : nullptr;
    };
    if (IsFinished()) return nullptr;
    if (confirmationPanel_ != nullptr && confirmationPanel_->IsActive())
    {
        const auto targets = confirmationPanel_->TabTargets();
        for (auto* target : targets)
            if (auto* result = usable(target)) return result;
    }
    if (promptPanel_ != nullptr && promptPanel_->IsActive())
    {
        const auto targets = promptPanel_->TabTargets();
        for (auto* target : targets)
            if (auto* result = usable(target)) return result;
    }
    // A server-authorized pending choice can be part of the room start flow
    // itself (notably pawn selection).  It must therefore remain reachable
    // while the lifecycle is ConfiguringStart, before the Room is officially
    // marked as started.
    if (choicesList_ != nullptr && choicesList_->GetCount() > 0)
        if (auto* result = usable(choicesList_)) return result;
    if (auto* result = usable(orderingChoices_)) return result;
    if (lifecycle_.Policy().focus != application::GamePlayFocusPolicy::GameplayTarget &&
        !lifecycle_.AllowsProjectedContentFocus())
        return nullptr;

    // Navigation is derived only from renderers that actually expose a usable
    // control. GamePlayPanel must not infer interaction priority from concrete
    // capabilities (cards, quiz, pawns, ...): those are presentation data and
    // can legitimately be combined differently by any game.
    const wxWindow* const preferred[] = {
        dicePanel_ != nullptr ? dicePanel_->NavigationTarget() : nullptr,
        handPanel_ != nullptr ? handPanel_->NavigationTarget() : nullptr,
        gridPanel_ != nullptr ? gridPanel_->NavigationTarget() : nullptr,
        movementPanel_ != nullptr ? movementPanel_->NavigationTarget() : nullptr,
        workflowPanel_ != nullptr ? workflowPanel_->NavigationTarget() : nullptr,
    };
    for (auto* candidate : preferred)
        if (auto* result = usable(const_cast<wxWindow*>(candidate))) return result;

    if (requiredOnly) return nullptr;
    if (linesList_ != nullptr && linesList_->GetCount() > 0)
        if (auto* result = usable(linesList_)) return result;
    return nullptr;
}
}
