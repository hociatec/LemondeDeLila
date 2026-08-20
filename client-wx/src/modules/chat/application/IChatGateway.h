#pragma once

#include <string>

namespace lila::modules::chat::application
{
class IChatGateway
{
public:
    virtual ~IChatGateway() = default;
    virtual void Open(const std::string& bearerToken, const std::string& clientVersion) = 0;
    virtual void Close() = 0;
    virtual void Interrupt() = 0;
    virtual void Send(const std::string& payload) = 0;
    [[nodiscard]] virtual std::string Receive() = 0;
};
}
