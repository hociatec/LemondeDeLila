#pragma once

#include <stop_token>
#include <string>
#include <string_view>
#include <vector>

#include "modules/vault/application/IVaultGateway.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::network::realtime { class AuthenticatedRealtimeApiClient; }

namespace lila::modules::vault::infrastructure
{
class VaultApi final : public application::IVaultGateway
{
public:
    VaultApi(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& sessionStore) noexcept;

    [[nodiscard]] std::vector<domain::VaultSnapshot> List(std::stop_token stopToken) const override;
    [[nodiscard]] std::string Save(int roomId, std::stop_token stopToken) const override;
    [[nodiscard]] int Restore(std::string_view snapshotId, std::stop_token stopToken) const override;
    void Delete(std::string_view snapshotId, std::stop_token stopToken) const override;
    void Abandon(int roomId, std::stop_token stopToken) const override;

private:
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
