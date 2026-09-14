#pragma once

#include "modules/admin/application/IAdminGateway.h"
#include "shared/network/application/http/AuthenticatedHttpClient.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::network::realtime { class AuthenticatedRealtimeApiClient; }

namespace lila::modules::admin::infrastructure
{
class AdminGateway final : public application::IAdminGateway
{
public:
    AdminGateway(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& apiClient,
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& notificationClient,
        lila::modules::session::application::SessionStore& sessionStore) noexcept;

    [[nodiscard]] nlohmann::json Execute(
        const domain::AdminCommand& command,
        const nlohmann::json& payload,
        const std::string& maintenanceToken,
        std::stop_token stopToken) const override;

private:
    [[nodiscard]] nlohmann::json ExecuteRealtime(
        const domain::AdminCommand& command,
        const nlohmann::json& payload,
        std::stop_token stopToken) const;
    [[nodiscard]] nlohmann::json ExecuteHttp(
        const domain::AdminCommand& command,
        const nlohmann::json& payload,
        const std::string& maintenanceToken,
        std::stop_token stopToken) const;

    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& apiClient_;
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& notificationClient_;
    lila::modules::session::application::SessionStore& sessionStore_;
    lila::shared::network::http::AuthenticatedHttpClient httpClient_;
};
}
