#pragma once

#include <string>

#include "shared/network/application/http/IWsTicketProvider.h"

namespace lila::shared::network::http
{
class WsTicketProvider final : public IWsTicketProvider
{
public:
    explicit WsTicketProvider(std::string backendApiWsEndpoint);

    [[nodiscard]] std::string GetTicket(const std::string& scope, const std::string& bearerToken) const override;

private:
    std::string backendApiWsEndpoint_;
};
}
