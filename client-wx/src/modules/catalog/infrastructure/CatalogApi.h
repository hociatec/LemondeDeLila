#pragma once

#include <stop_token>

#include "modules/catalog/application/ICatalogGateway.h"

namespace lila::shared::network::realtime
{
class RealtimeApiClient;
}

namespace lila::modules::catalog::infrastructure
{
class CatalogApi final : public application::ICatalogGateway
{
public:
    explicit CatalogApi(
        lila::shared::network::realtime::RealtimeApiClient& client) noexcept;

    [[nodiscard]] std::vector<domain::CatalogShelf> GetShelves(std::stop_token stopToken) const override;

private:
    lila::shared::network::realtime::RealtimeApiClient& client_;
};
}
