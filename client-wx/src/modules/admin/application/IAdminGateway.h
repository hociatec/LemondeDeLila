#pragma once

#include <stop_token>
#include <string>

#include <nlohmann/json_fwd.hpp>

#include "modules/admin/domain/AdminCommand.h"

namespace lila::modules::admin::application
{
class IAdminGateway
{
public:
    virtual ~IAdminGateway() = default;
    [[nodiscard]] virtual nlohmann::json Execute(
        const domain::AdminCommand& command,
        const nlohmann::json& payload,
        const std::string& maintenanceToken,
        std::stop_token stopToken) const = 0;
};
}
