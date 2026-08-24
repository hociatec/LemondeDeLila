#pragma once

#include <nlohmann/json_fwd.hpp>

#include "modules/storybook/application/IStoryBookGateway.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::network::realtime { class AuthenticatedRealtimeApiClient; }

namespace lila::modules::storybook::infrastructure
{
class StoryBookApi final : public application::IStoryBookGateway
{
public:
    StoryBookApi(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& sessionStore) noexcept;

    [[nodiscard]] std::vector<domain::StoryBookGame> LoadOwn(std::stop_token stopToken) const override;
    [[nodiscard]] std::vector<domain::StoryBookGame> LoadUser(int userId, std::stop_token stopToken) const override;

private:
    [[nodiscard]] std::vector<domain::StoryBookGame> Request(
        const char* eventName,
        nlohmann::json payload,
        std::stop_token stopToken) const;

    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
