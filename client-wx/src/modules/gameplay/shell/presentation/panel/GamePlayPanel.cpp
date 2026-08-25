#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/session/application/GameSessionService.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"

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

void GamePlayPanel::Open(int roomId, std::string gameType, std::string gameName)
{
    if (roomId <= 0 || gameType.empty()) return;
    if (IsOpenFor(roomId, gameType)) return;
    CloseSession();
    AttachEventHandler();
    roomId_ = roomId;
    gameType_ = std::move(gameType);
    gameName_ = std::move(gameName);
    ClearView();
    StartJoin();
}

void GamePlayPanel::CloseSession()
{
    requestSlot_.Cancel();
    service_.ClearEventHandler();
    service_.Close();
    roomId_ = 0;
    gameType_.clear();
    gameName_.clear();
    state_ = {};
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
    return state_.status == "finished";
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

wxWindow* GamePlayPanel::ActiveNavigationTarget() const noexcept
{
    return pawnSelectionPanel_ != nullptr
        ? pawnSelectionPanel_->NavigationTarget()
        : nullptr;
}
}
