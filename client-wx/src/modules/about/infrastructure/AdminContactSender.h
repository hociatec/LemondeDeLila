#pragma once
#include "modules/about/application/IAdminContactSender.h"
namespace lila::shared::network::realtime { class AuthenticatedRealtimeApiClient; }
namespace lila::modules::session::application { class SessionStore; }
namespace lila::modules::about::infrastructure
{
class AdminContactSender final : public application::IAdminContactSender
{
public:
    AdminContactSender(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& sessionStore)
        : client_(client), sessionStore_(sessionStore) {}
    void Send(const std::string& message, std::stop_token stopToken) const override;
private:
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
