#pragma once

#include <string_view>

#include "app/navigation/domain/ViewId.h"

namespace lila::app::navigation
{
[[nodiscard]] constexpr std::string_view InterfaceTitle(domain::ViewId viewId) noexcept
{
    switch (viewId)
    {
    case domain::ViewId::Home: return "Accueil";
    case domain::ViewId::MainMenu: return "Menu principal";
    case domain::ViewId::Catalog: return "Taverne";
    case domain::ViewId::JoinRooms: return "Rejoindre une partie";
    case domain::ViewId::Vault: return "Coffre-fort";
    case domain::ViewId::Room: return "Table de jeu";
    case domain::ViewId::StoryBook: return "Livre des contes";
    case domain::ViewId::Leaderboard: return "Classement";
    case domain::ViewId::Chat: return "Tchat";
    case domain::ViewId::Messaging: return "Messages";
    case domain::ViewId::Social: return "Social";
    case domain::ViewId::Presence: return "Présence";
    case domain::ViewId::About: return "À propos";
    case domain::ViewId::Options: return "Options";
    case domain::ViewId::Admin: return "Administration";
    case domain::ViewId::None: case domain::ViewId::Count: return {};
    }
    return {};
}
}
