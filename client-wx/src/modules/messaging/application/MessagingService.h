#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"
#include "modules/messaging/application/IMessagingGateway.h"
#include "modules/messaging/infrastructure/MessagingProtocolFields.h"

namespace lila::modules::audio::application
{
class IAudioService;
}

namespace lila::modules::messaging::application
{
class MessagingService final
{
public:
    MessagingService(
        IMessagingGateway& api,
        lila::modules::audio::application::IAudioService& audioService);

    [[nodiscard]] std::vector<domain::MessagingMessage> LoadBox(
        domain::MessagingBox box,
        int limit = lila::modules::messaging::infrastructure::fields::DefaultPageLimit) const;
    [[nodiscard]] std::optional<domain::MessagingMessage> Send(
        int recipientId,
        const std::string& text,
        const std::optional<std::string>& subject) const;
    [[nodiscard]] std::optional<domain::MessagingMessage> Delete(const std::string& messageId) const;
    [[nodiscard]] std::optional<domain::MessagingMessage> Restore(const std::string& messageId) const;
    [[nodiscard]] std::optional<domain::MessagingMessage> Purge(const std::string& messageId) const;
    [[nodiscard]] std::optional<domain::MessagingUser> SearchUser(const std::string& query) const;
    void MarkRead(const std::string& messageId) const;

private:
    IMessagingGateway& api_;
    lila::modules::audio::application::IAudioService& audioService_;
};
}
