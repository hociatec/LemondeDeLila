#include "modules/shortcuts/infrastructure/ShortcutGateway.h"
#include "modules/session/application/SessionStore.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "generated/protocol/WsMessageTypes.generated.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/persistence/infrastructure/JsonFileStorage.h"
#include "shared/errors/domain/AppError.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::shortcuts::infrastructure
{
namespace
{
using Storage = lila::shared::persistence::JsonFileStorage;
domain::ShortcutSnapshot Decode(const nlohmann::json& data)
{
    domain::ShortcutSnapshot value;
    value.revision = data.at("revision").get<int>();
    if (value.revision < 0 || !data.at("items").is_array() || data.at("items").size() > 50)
        throw std::runtime_error("Préférences de raccourcis invalides.");
    for (const auto& item : data.at("items"))
        value.items.push_back({item.at("target").get<std::string>(), item.at("label").get<std::string>(),
            item.at("chord").get<std::string>(), item.at("enabled").get<bool>()});
    const auto error = domain::Validate(value.items);
    if (!error.empty()) throw std::runtime_error(error);
    return value;
}
nlohmann::json Encode(const domain::ShortcutSnapshot& value)
{
    auto items = nlohmann::json::array();
    for (const auto& item : value.items)
        items.push_back({{"target", item.target}, {"label", item.label}, {"chord", item.chord}, {"enabled", item.enabled}});
    return {{"revision", value.revision}, {"items", items}};
}
auto CachePath(int userId)
{
    return Storage::ResolvePath(("shortcuts-" + std::to_string(userId) + ".json").c_str());
}
}
domain::ShortcutSnapshot ShortcutGateway::Cached(int userId) const
{
    nlohmann::json data;
    try
    {
        if (!Storage::ReadIfExists(CachePath(userId), data) ||
            data.value("server", std::string{}) != lila::shared::config::AppConfig::ResolveBackendApiWs()) return {};
        return Decode(data);
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogWarning("ShortcutsCache", error.what());
        return {};
    }
}
domain::ShortcutSnapshot ShortcutGateway::Request(int userId, const std::string& event,
    nlohmann::json payload, std::stop_token stop) const
{
    // Capture identity and token together; a late request must not use a new account.
    (void)session_.AccessToken(stop);
    auto identity = session_.Current();
    if (identity.userId.value != userId || !identity.IsAuthenticated())
        throw std::runtime_error("La session a changé.");
    auto response = client_.Send({event, std::move(payload)}, identity.token, stop);
    if (!response.success)
        throw lila::shared::errors::AppException(lila::shared::errors::ToAppError(
            response.errorMessage.empty() ? "Synchronisation des raccourcis impossible." : response.errorMessage));
    auto result = Decode(response.payload);
    result.synchronized = true;
    auto cache = Encode(result);
    cache["server"] = lila::shared::config::AppConfig::ResolveBackendApiWs();
    try { Storage::Write(CachePath(userId), cache, "Sauvegarde locale des raccourcis impossible."); }
    catch (const std::exception& error) { lila::shared::logging::LogWarning("ShortcutsCache", error.what()); }
    return result;
}
domain::ShortcutSnapshot ShortcutGateway::Load(int userId, std::stop_token stop) const
{
    return Request(userId, std::string(lila::shared::network::ws::types::users::ShortcutsGet), nlohmann::json::object(), stop);
}
domain::ShortcutSnapshot ShortcutGateway::Save(int userId, const domain::ShortcutSnapshot& value, std::stop_token stop) const
{
    return Request(userId, std::string(lila::shared::network::ws::types::users::ShortcutsSet), Encode(value), stop);
}
}
