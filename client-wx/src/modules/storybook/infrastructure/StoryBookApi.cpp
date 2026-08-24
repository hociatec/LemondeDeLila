#include "modules/storybook/infrastructure/StoryBookApi.h"

#include <nlohmann/json.hpp>

#include "modules/session/application/SessionStore.h"
#include "modules/storybook/infrastructure/StoryBookPayloadCodec.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"

namespace lila::modules::storybook::infrastructure
{
StoryBookApi::StoryBookApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore) noexcept
    : client_(client), sessionStore_(sessionStore)
{
}

std::vector<domain::StoryBookGame> StoryBookApi::LoadOwn(std::stop_token stopToken) const
{
    return Request("stats.my", nlohmann::json::object(), stopToken);
}

std::vector<domain::StoryBookGame> StoryBookApi::LoadUser(int userId, std::stop_token stopToken) const
{
    return Request("stats.user", nlohmann::json{{"userId", userId}}, stopToken);
}

std::vector<domain::StoryBookGame> StoryBookApi::Request(
    const char* eventName,
    nlohmann::json payload,
    std::stop_token stopToken) const
{
    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_,
        sessionStore_,
        lila::shared::errors::NoActiveStoryBookSession,
        eventName,
        std::move(payload),
        lila::shared::errors::StoryBookLoadFailed,
        stopToken);
    return codec::ReadStoryBookPayload(response.payload);
}
}
