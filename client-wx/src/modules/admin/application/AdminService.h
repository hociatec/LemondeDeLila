#pragma once

#include <stop_token>
#include <string>

#include <nlohmann/json_fwd.hpp>

#include "modules/admin/domain/AdminCommand.h"

namespace lila::modules::admin::application
{
class IAdminGateway;
class AdminService final
{
public:
    explicit AdminService(IAdminGateway& gateway) noexcept;
    [[nodiscard]] nlohmann::json Execute(
        const domain::AdminCommand& command,
        const nlohmann::json& payload,
        const std::string& maintenanceToken,
        std::stop_token stopToken) const;

private:
    IAdminGateway& gateway_;
};
}
