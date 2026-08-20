#include "modules/messaging/infrastructure/MessagingApi.h"
#include "modules/messaging/infrastructure/MessagingPayloadCodec.h"

#include <optional>
#include <utility>

#include "modules/messaging/infrastructure/MessagingProtocolFields.h"
#include "modules/session/application/SessionStore.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/WsMessageTypes.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"

namespace lila::modules::messaging::infrastructure
{
MessagingApi::MessagingApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore)
    : client_(client),
      sessionStore_(sessionStore)
{
}

std::vector<domain::MessagingMessage> MessagingApi::GetBox(domain::MessagingBox box, int limit) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Messages),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::Box), codec::BoxToString(box)},
            {std::string(lila::modules::messaging::infrastructure::fields::Limit), limit},
        },
        lila::shared::errors::MessagingLoadBoxFailed);
    return codec::ReadMessagesPayload(response);
}

std::vector<domain::MessagingMessage> MessagingApi::GetConversation(int userId, int limit) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Conversation),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::ConversationUserId), userId},
            {std::string(lila::modules::messaging::infrastructure::fields::Limit), limit},
        },
        lila::shared::errors::MessagingLoadConversationFailed);
    return codec::ReadMessagesPayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Send(
    int recipientId,
    const std::string& text,
    const std::optional<std::string>& subject) const
{
    nlohmann::json payload = {
        {std::string(lila::modules::messaging::infrastructure::fields::RecipientId), recipientId},
        {std::string(lila::modules::messaging::infrastructure::fields::Text), text},
    };
    if (subject.has_value() && !subject->empty())
    {
        payload[std::string(lila::modules::messaging::infrastructure::fields::Subject)] = *subject;
    }

    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Send),
        std::move(payload),
        lila::shared::errors::MessagingSendFailed);
    return codec::ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Delete(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Delete),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingDeleteFailed);
    return codec::ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Restore(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Restore),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingRestoreFailed);
    return codec::ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Purge(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Purge),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingPurgeFailed);
    return codec::ReadMessagePayload(response);
}

std::optional<domain::MessagingUser> MessagingApi::SearchUser(const std::string& query) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Search),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::Query), query},
        },
        lila::shared::errors::MessagingSearchUserFailed);
    return codec::ReadSearchUserPayload(response);
}

void MessagingApi::MarkRead(const std::string& messageId) const
{
    static_cast<void>(SendRequest(
        std::string(lila::shared::network::ws::types::messaging::MarkRead),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingMarkReadFailed));
}

lila::shared::network::realtime::RealtimeApiResponse MessagingApi::SendRequest(
    const std::string& type,
    nlohmann::json payload,
    const std::string& fallbackMessage) const
{
    return lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_,
        sessionStore_,
        lila::shared::errors::NoActiveMessagingSession,
        type,
        std::move(payload),
        fallbackMessage);
}
}
