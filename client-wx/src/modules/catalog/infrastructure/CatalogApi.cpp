#include "modules/catalog/infrastructure/CatalogApi.h"

#include <string>
#include <stdexcept>

#include <nlohmann/json.hpp>

#include "modules/catalog/infrastructure/CatalogPayloadCodec.h"
#include "modules/catalog/domain/CatalogErrorMessages.h"
#include "shared/errors/presentation/ErrorFormatting.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::modules::catalog::infrastructure
{
namespace
{
constexpr const char* CatalogAllEvent = "catalog.all";
}

CatalogApi::CatalogApi(
    lila::shared::network::realtime::RealtimeApiClient& client) noexcept
    : client_(client)
{
}

std::vector<domain::CatalogShelf> CatalogApi::GetShelves(std::stop_token stopToken) const
{
    if (stopToken.stop_requested())
    {
        return {};
    }

    const auto response = client_.Send(
        {CatalogAllEvent, nlohmann::json::object()}, stopToken);
    if (!response.success)
    {
        throw std::runtime_error(lila::shared::errors::WithDetails(
            lila::shared::errors::CatalogLoadFailed,
            response.errorMessage));
    }
    if (stopToken.stop_requested())
    {
        return {};
    }
    return codec::ReadShelvesPayload(response.payload);
}
}
