#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/application/GameSessionService.h"

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
}
