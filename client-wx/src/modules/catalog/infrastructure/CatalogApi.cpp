#include "modules/catalog/infrastructure/CatalogApi.h"

#include <string>

#include <nlohmann/json.hpp>

#include "modules/catalog/infrastructure/CatalogPayloadCodec.h"
#include "modules/session/application/SessionStore.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"

namespace lila::modules::catalog::infrastructure
{
namespace
{
constexpr const char* CatalogAllEvent = "catalog.all";
}

CatalogApi::CatalogApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore) noexcept
    : client_(client), sessionStore_(sessionStore)
{
}

std::vector<domain::CatalogShelf> CatalogApi::GetShelves(std::stop_token stopToken) const
{
    if (stopToken.stop_requested())
    {
        return {};
    }

    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_,
        sessionStore_,
        lila::shared::errors::NoActiveCatalogSession,
        CatalogAllEvent,
        nlohmann::json::object(),
        lila::shared::errors::CatalogLoadFailed,
        stopToken);
    if (stopToken.stop_requested())
    {
        return {};
    }
    return codec::ReadShelvesPayload(response.payload);
}
}
