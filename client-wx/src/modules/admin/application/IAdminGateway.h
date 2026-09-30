#pragma once

#include <stop_token>
#include <string>

#include "modules/admin/domain/AdminCommand.h"
#include "modules/admin/domain/AdminPayload.h"

namespace lila::modules::admin::application
{
class IAdminGateway
{
public:
    virtual ~IAdminGateway() = default;
    [[nodiscard]] virtual domain::AdminPayload Execute(
        const domain::AdminCommand& command,
        const domain::AdminPayload& payload,
        const std::string& maintenanceToken,
        std::stop_token stopToken) const = 0;
};
}
