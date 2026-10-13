#pragma once
#include <nlohmann/json.hpp>
#include "modules/shortcuts/application/IShortcutGateway.h"
namespace lila::shared::network::realtime { class AuthenticatedRealtimeApiClient; }
namespace lila::modules::session::application { class SessionStore; }
namespace lila::modules::shortcuts::infrastructure
{
class ShortcutGateway final : public application::IShortcutGateway
{
public:
    ShortcutGateway(lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& session) : client_(client), session_(session) {}
    domain::ShortcutSnapshot Cached(int userId) const override;
    domain::ShortcutSnapshot Load(int userId, std::stop_token stop) const override;
    domain::ShortcutSnapshot Save(int userId, const domain::ShortcutSnapshot& value, std::stop_token stop) const override;
private:
    domain::ShortcutSnapshot Request(int userId, const std::string& event, nlohmann::json payload, std::stop_token stop) const;
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& session_;
};
}
