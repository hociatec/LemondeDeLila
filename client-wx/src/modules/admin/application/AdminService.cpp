#include "modules/admin/application/AdminService.h"

#include <nlohmann/json.hpp>

#include "modules/admin/application/IAdminGateway.h"

namespace lila::modules::admin::application
{
AdminService::AdminService(IAdminGateway& gateway) noexcept : gateway_(gateway) {}

nlohmann::json AdminService::Execute(
    const domain::AdminCommand& command,
    const nlohmann::json& payload,
    const std::string& maintenanceToken,
    std::stop_token stopToken) const
{
    return gateway_.Execute(command, payload, maintenanceToken, stopToken);
}
}
