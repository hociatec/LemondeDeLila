#include "app/navigation/presentation/AppNavigator.h"

#include <stop_token>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/catalog/presentation/CatalogPanel.h"
#include "modules/leaderboard/presentation/LeaderboardPanel.h"
#include "modules/rooms/presentation/join/JoinRoomsPanel.h"
#include "modules/rooms/presentation/shell/RoomPanel.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/Session.h"
#include "modules/storybook/presentation/StoryBookPanel.h"
#include "modules/vault/application/VaultService.h"
#include "modules/vault/presentation/VaultPanel.h"
#include "shared/logging/application/Logger.h"

namespace lila::app::navigation
{
using domain::ViewId;

wxWindow* AppNavigator::CreateGameView(ViewId viewId)
{
    switch (viewId)
    {
    case ViewId::Catalog:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Catalog): constructing CatalogPanel view.");
        return new modules::catalog::presentation::CatalogPanel(
            hostFrame_->ContentParent(),
            catalogService_,
            optionsStore_,
            [this]() { ShowJoinRooms(); },
            [this]() { ShowOwnStoryBook(); },
            [this]() { ShowVault(); },
            [this](const modules::catalog::domain::CatalogGame& game) { CreateRoom(game); },
            [this]() { ShowSession(lastMainMenuSelection_); });
    case ViewId::JoinRooms:
        return new modules::rooms::presentation::JoinRoomsPanel(
            hostFrame_->ContentParent(),
            roomLobbyService_,
            [this](int roomId, bool spectator) { JoinRoom(roomId, spectator); },
            [this]() { ReplaceView(ViewId::Catalog, GetOrCreateView(ViewId::Catalog)); });
    case ViewId::Vault:
        return new modules::vault::presentation::VaultPanel(
            hostFrame_->ContentParent(),
            vaultService_,
            [this](int roomId) { RestoreRoom(roomId); },
            [this]() { ReplaceView(ViewId::Catalog, GetOrCreateView(ViewId::Catalog)); });
    case ViewId::Room:
        return new modules::rooms::presentation::RoomPanel(
            hostFrame_->ContentParent(),
            roomSessionService_,
            roomLobbyService_,
            gameSessionService_,
            audioService_,
            [this]()
            {
                return sessionStore_.HasActiveSession() ? sessionStore_.Current().userId.value : 0;
            },
            [this](int roomId, std::stop_token stopToken)
            {
                return vaultService_.Save(roomId, stopToken);
            },
            [this](int roomId, std::stop_token stopToken)
            {
                vaultService_.Abandon(roomId, stopToken);
            },
            [this]() { ReturnToCatalogAfterRoomClose(true, true); });
    case ViewId::StoryBook:
        lila::shared::logging::LogInfo("Navigator", "CreateView(StoryBook): constructing StoryBookPanel view.");
        return new modules::storybook::presentation::StoryBookPanel(
            hostFrame_->ContentParent(),
            storyBookService_,
            [this]() { ShowLeaderboard(); },
            [this]() { ReplaceView(storyBookReturnView_, GetOrCreateView(storyBookReturnView_)); });
    case ViewId::Leaderboard:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Leaderboard): constructing LeaderboardPanel view.");
        return new modules::leaderboard::presentation::LeaderboardPanel(
            hostFrame_->ContentParent(),
            leaderboardService_,
            [this]() { ReplaceView(ViewId::StoryBook, GetOrCreateView(ViewId::StoryBook)); });
    default:
        return nullptr;
    }
}
}
