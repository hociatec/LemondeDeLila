#pragma once

namespace lila::modules::audio::application
{
class IAudioService;
}

namespace lila::modules::catalog::application
{
class CatalogService;
}

namespace lila::modules::chat::application
{
class ChatService;
}

namespace lila::modules::leaderboard::application
{
class LeaderboardService;
}

namespace lila::modules::gameplay::application
{
class GameSessionService;
}

namespace lila::modules::messaging::application
{
class MessagingService;
}

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::presence::application
{
class PresenceMonitor;
}

namespace lila::modules::rooms::application
{
class RoomLobbyService;
class RoomSessionService;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::social::application
{
class SocialService;
}

namespace lila::modules::storybook::application
{
class StoryBookService;
}

namespace lila::modules::user::application
{
class LoginUseCase;
class RegisterUseCase;
}

namespace lila::modules::vault::application
{
class VaultService;
}

namespace lila::app::navigation
{
struct AuthNavigationDependencies final
{
    lila::modules::user::application::LoginUseCase& loginUseCase;
    lila::modules::user::application::RegisterUseCase& registerUseCase;
    lila::modules::session::application::SessionStore& sessionStore;
    lila::modules::options::application::OptionsStore& optionsStore;
};

struct GameNavigationDependencies final
{
    lila::modules::catalog::application::CatalogService& catalogService;
    lila::modules::rooms::application::RoomLobbyService& roomLobbyService;
    lila::modules::rooms::application::RoomSessionService& roomSessionService;
    lila::modules::vault::application::VaultService& vaultService;
    lila::modules::storybook::application::StoryBookService& storyBookService;
    lila::modules::leaderboard::application::LeaderboardService& leaderboardService;
    lila::modules::gameplay::application::GameSessionService& gameSessionService;
};

struct SocialNavigationDependencies final
{
    lila::modules::chat::application::ChatService& chatService;
    lila::modules::messaging::application::MessagingService& messagingService;
    lila::modules::social::application::SocialService& socialService;
    lila::modules::presence::application::PresenceMonitor& presenceMonitor;
};

struct AudioNavigationDependencies final
{
    lila::modules::audio::application::IAudioService& audioService;
};
}
