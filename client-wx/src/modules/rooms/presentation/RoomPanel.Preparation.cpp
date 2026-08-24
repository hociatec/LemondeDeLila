#include "modules/rooms/presentation/RoomPanel.h"

#include <utility>

namespace lila::modules::rooms::presentation
{
void RoomPanel::PrepareCreate(std::string gameType, PreparedHandler onPrepared)
{
    PrepareCreate(std::move(gameType), {}, {}, {}, 0, 0, std::move(onPrepared));
}

void RoomPanel::PrepareCreate(
    std::string gameType,
    std::string gameName,
    std::string gameSummary,
    std::string gameEngine,
    int minPlayers,
    int maxPlayers,
    PreparedHandler onPrepared)
{
    request_ = RoomOpenRequest::Create(
        std::move(gameType), std::move(gameName), std::move(gameSummary),
        std::move(gameEngine), minPlayers, maxPlayers);
    saveInProgress_ = false;
    abandonInProgress_ = false;
    chatHistoryReceived_ = false;
    pendingRoomAnnouncements_.clear();
    room_ = {};
    room_.gameType = request_.gameType;
    room_.gameName = request_.gameName.empty() ? request_.gameType : request_.gameName;
    room_.gameSummary = request_.gameSummary;
    room_.gameEngine = request_.gameEngine;
    room_.name = "Table de jeu";
    room_.minPlayers = request_.minPlayers;
    room_.maxPlayers = request_.maxPlayers;
    ShowConnecting();
    if (onPrepared) onPrepared();
    StartRequest();
}

void RoomPanel::PrepareJoin(
    int roomId,
    bool spectator,
    PreparedHandler onPrepared)
{
    request_ = RoomOpenRequest::Join(roomId, spectator);
    saveInProgress_ = false;
    abandonInProgress_ = false;
    chatHistoryReceived_ = false;
    pendingRoomAnnouncements_.clear();
    room_ = {};
    room_.gameName = "Table de jeu";
    room_.name = "Table de jeu";
    ShowConnecting();
    if (onPrepared) onPrepared();
    StartRequest();
}

void RoomPanel::PrepareRestore(int roomId, PreparedHandler onPrepared)
{
    request_ = RoomOpenRequest::Restore(roomId);
    saveInProgress_ = false;
    abandonInProgress_ = false;
    chatHistoryReceived_ = false;
    pendingRoomAnnouncements_.clear();
    room_ = {};
    room_.gameName = "Table restaur" "\xC3\xA9" "e";
    room_.name = "Table restaur" "\xC3\xA9" "e";
    ShowConnecting();
    if (onPrepared) onPrepared();
    StartRequest();
}
}
