#pragma once

#include <stop_token>

#include "modules/catalog/application/ICatalogGateway.h"

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::shared::network::realtime
{
class AuthenticatedRealtimeApiClient;
}

namespace lila::modules::catalog::infrastructure
{
class CatalogApi final : public application::ICatalogGateway
{
public:
    CatalogApi(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& sessionStore) noexcept;

    [[nodiscard]] std::vector<domain::CatalogShelf> GetShelves(std::stop_token stopToken) const override;

private:
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
