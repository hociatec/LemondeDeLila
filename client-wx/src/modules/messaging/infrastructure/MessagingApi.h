#pragma once

#include <nlohmann/json.hpp>

#include <optional>
#include <string>
#include <vector>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"
#include "modules/messaging/application/IMessagingGateway.h"
#include "shared/network/realtime/RealtimeApiClient.h"
#include "shared/contracts/BackendWsContracts.h"

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::shared::network::realtime
{
class AuthenticatedRealtimeApiClient;
}

namespace lila::modules::messaging::infrastructure
{
class MessagingApi final : public lila::modules::messaging::application::IMessagingGateway
{
public:
    MessagingApi(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& sessionStore);

    [[nodiscard]] std::vector<domain::MessagingMessage> GetBox(
        domain::MessagingBox box,
        int limit = lila::shared::contracts::messaging::DefaultPageLimit) const override;
    [[nodiscard]] std::vector<domain::MessagingMessage> GetConversation(
        int userId,
        int limit = lila::shared::contracts::messaging::DefaultPageLimit) const override;
    [[nodiscard]] std::optional<domain::MessagingMessage> Send(
        int recipientId,
        const std::string& text,
        const std::optional<std::string>& subject) const override;
    [[nodiscard]] std::optional<domain::MessagingMessage> Delete(const std::string& messageId) const override;
    [[nodiscard]] std::optional<domain::MessagingMessage> Restore(const std::string& messageId) const override;
    [[nodiscard]] std::optional<domain::MessagingMessage> Purge(const std::string& messageId) const override;
    [[nodiscard]] std::optional<domain::MessagingUser> SearchUser(const std::string& query) const override;
    void MarkRead(const std::string& messageId) const override;

private:
    [[nodiscard]] std::vector<domain::MessagingMessage> ReadMessagesPayload(
        const lila::shared::network::realtime::RealtimeApiResponse& response) const;
    [[nodiscard]] std::optional<domain::MessagingMessage> ReadMessagePayload(
        const lila::shared::network::realtime::RealtimeApiResponse& response) const;
    [[nodiscard]] static domain::MessagingMessage ReadMessage(const nlohmann::json& source);
    [[nodiscard]] static domain::MessagingUser ReadUser(const nlohmann::json& source);
    [[nodiscard]] static std::string ReadOptionalString(const nlohmann::json& source, const char* fieldName);
    [[nodiscard]] lila::shared::network::realtime::RealtimeApiResponse SendRequest(
        const std::string& type,
        nlohmann::json payload,
        const std::string& fallbackMessage) const;

    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
