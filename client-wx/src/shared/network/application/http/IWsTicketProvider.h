#pragma once

#include <stdexcept>
#include <string>

namespace lila::shared::network::http
{
class IWsTicketProvider
{
public:
    virtual ~IWsTicketProvider() = default;
    [[nodiscard]] virtual std::string GetTicket(
        const std::string& scope,
        const std::string& bearerToken) const = 0;
};

class WsTicketRequestError final : public std::runtime_error
{
public:
    WsTicketRequestError(std::string message, unsigned long statusCode);
    [[nodiscard]] unsigned long StatusCode() const;

private:
    unsigned long statusCode_;
};
}
