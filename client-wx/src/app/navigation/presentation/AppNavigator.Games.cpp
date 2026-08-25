#include "app/navigation/presentation/AppNavigator.h"

#include <utility>

#include "modules/catalog/domain/CatalogShelf.h"
#include "modules/catalog/presentation/CatalogPanel.h"
#include "modules/leaderboard/presentation/LeaderboardPanel.h"
#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/presentation/join/JoinRoomsPanel.h"
#include "modules/rooms/presentation/shell/RoomPanel.h"
#include "modules/storybook/presentation/StoryBookPanel.h"
#include "modules/vault/presentation/VaultPanel.h"

namespace lila::app::navigation
{
using domain::ViewId;

void AppNavigator::ShowCatalog(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    auto* view = GetOrCreateView(ViewId::Catalog);
    if (auto* panel = dynamic_cast<modules::catalog::presentation::CatalogPanel*>(view))
    {
        panel->ResetToRootForNextShow();
    }
    ReplaceView(ViewId::Catalog, view);
}

void AppNavigator::ShowJoinRooms()
{
    auto* view = GetOrCreateView(ViewId::JoinRooms);
    ReplaceView(ViewId::JoinRooms, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::JoinRoomsPanel*>(view))
    {
        panel->Prepare({});
    }
}

void AppNavigator::ShowVault()
{
    auto* view = GetOrCreateView(ViewId::Vault);
    if (resetVaultFocusOnNextOpen_)
    {
        focusTransition_.Forget(view);
        if (auto* panel = dynamic_cast<modules::vault::presentation::VaultPanel*>(view))
        {
            panel->ResetSelectionForNextPrepare();
        }
        resetVaultFocusOnNextOpen_ = false;
    }
    ReplaceView(ViewId::Vault, view);
    if (auto* panel = dynamic_cast<modules::vault::presentation::VaultPanel*>(view))
    {
        panel->Prepare({});
    }
}

void AppNavigator::CreateRoom(const modules::catalog::domain::CatalogGame& game)
{
    auto* view = GetOrCreateView(ViewId::Room);
    ReplaceView(ViewId::Room, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::RoomPanel*>(view))
    {
        panel->PrepareCreate(game.id, game.name, game.summary, game.engine, game.minPlayers, game.maxPlayers, {});
    }
}

void AppNavigator::JoinRoom(int roomId, bool spectator)
{
    const auto sourceView = currentViewId_;
    auto* view = GetOrCreateView(ViewId::Room);
    ReplaceView(ViewId::Room, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::RoomPanel*>(view))
    {
        panel->PrepareJoin(
            roomId,
            spectator,
            [this, sourceView]()
            {
                if (currentViewId_ != ViewId::Room && currentViewId_ != sourceView)
                {
                    roomSessionService_.Leave();
                }
            });
    }
}

void AppNavigator::RestoreRoom(int roomId)
{
    const auto sourceView = currentViewId_;
    auto* view = GetOrCreateView(ViewId::Room);
    ReplaceView(ViewId::Room, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::RoomPanel*>(view))
    {
        panel->PrepareRestore(
            roomId,
            [this, sourceView]()
            {
                if (currentViewId_ != ViewId::Room && currentViewId_ != sourceView)
                {
                    roomSessionService_.Leave();
                }
            });
    }
}

void AppNavigator::ShowOwnStoryBook()
{
    storyBookReturnView_ = ViewId::Catalog;
    auto* view = GetOrCreateView(ViewId::StoryBook);
    if (auto* panel = dynamic_cast<modules::storybook::presentation::StoryBookPanel*>(view))
    {
        panel->OpenOwn();
    }
    ReplaceView(ViewId::StoryBook, view);
}

void AppNavigator::ShowUserStoryBook(int userId, std::string username, ViewId returnView)
{
    storyBookReturnView_ = returnView;
    auto* view = GetOrCreateView(ViewId::StoryBook);
    if (auto* panel = dynamic_cast<modules::storybook::presentation::StoryBookPanel*>(view))
    {
        panel->OpenUser(userId, std::move(username));
    }
    ReplaceView(ViewId::StoryBook, view);
}

void AppNavigator::ShowLeaderboard()
{
    auto* view = GetOrCreateView(ViewId::Leaderboard);
    if (auto* panel = dynamic_cast<modules::leaderboard::presentation::LeaderboardPanel*>(view))
    {
        panel->Prepare(
            [this, view]()
            {
                if (currentViewId_ == ViewId::StoryBook)
                {
                    ReplaceView(ViewId::Leaderboard, view);
                }
            });
    }
}

void AppNavigator::ReturnToCatalogAfterRoomClose(bool resetVaultFocus, bool resetCatalogFocus)
{
    resetVaultFocusOnNextOpen_ = resetVaultFocus;
    auto* view = GetOrCreateView(ViewId::Catalog);
    if (resetCatalogFocus)
    {
        focusTransition_.Forget(view);
        if (auto* panel = dynamic_cast<modules::catalog::presentation::CatalogPanel*>(view))
        {
            panel->ResetToRootForNextShow();
        }
    }
    ReplaceView(ViewId::Catalog, view);
}
}
