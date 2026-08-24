#pragma once

#include <memory>

#include "bootstrap/composition/application/StepLogger.h"

namespace lila::modules::audio::application { class IAudioService; }
namespace lila::modules::chat::application { class ChatService; }
namespace lila::modules::chat::infrastructure { class ChatProtocol; class PresenceChatGateway; }
namespace lila::modules::messaging::application { class MessagingService; }
namespace lila::modules::messaging::infrastructure { class MessagingApi; }
namespace lila::modules::options::application { class OptionsStore; }
namespace lila::modules::presence::application { class PresenceMonitor; }
namespace lila::modules::session::application { class SessionStore; }
namespace lila::modules::social::application { class SocialService; }
namespace lila::modules::social::infrastructure { class SocialApi; }

namespace lila::bootstrap
{
struct NetworkComposition;

struct SocialComposition final
{
    SocialComposition();
    ~SocialComposition();

    void Assemble(
        NetworkComposition& network,
        lila::modules::session::application::SessionStore& sessionStore,
        lila::modules::options::application::OptionsStore& optionsStore,
        lila::modules::audio::application::IAudioService& audioService,
        const StepLogger& setStep);

    std::unique_ptr<lila::modules::chat::infrastructure::PresenceChatGateway> chatGateway;
    std::unique_ptr<lila::modules::chat::infrastructure::ChatProtocol> chatProtocol;
    std::unique_ptr<lila::modules::chat::application::ChatService> chatService;
    std::unique_ptr<lila::modules::messaging::infrastructure::MessagingApi> messagingApi;
    std::unique_ptr<lila::modules::messaging::application::MessagingService> messagingService;
    std::unique_ptr<lila::modules::social::infrastructure::SocialApi> socialApi;
    std::unique_ptr<lila::modules::social::application::SocialService> socialService;
    std::unique_ptr<lila::modules::presence::application::PresenceMonitor> presenceMonitor;
};
}
