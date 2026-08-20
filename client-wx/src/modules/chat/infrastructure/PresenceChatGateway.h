#pragma once

#include <string>

#include "modules/chat/application/IChatGateway.h"

namespace lila::shared::network::http
{
class WsTicketProvider;
}

namespace lila::shared::network::websocket
{
class IWebSocketClient;
}

namespace lila::modules::chat::infrastructure
{
class PresenceChatGateway final : public lila::modules::chat::application::IChatGateway
{
public:
    PresenceChatGateway(
        std::string endpoint,
        lila::shared::network::websocket::IWebSocketClient& webSocketClient,
        lila::shared::network::http::WsTicketProvider& ticketProvider);

    void Open(const std::string& bearerToken, const std::string& clientVersion) override;
    void Close() override;
    void Interrupt() override;
    void Send(const std::string& payload) override;
    [[nodiscard]] std::string Receive() override;

private:
    std::string endpoint_;
    lila::shared::network::websocket::IWebSocketClient& webSocketClient_;
    lila::shared::network::http::WsTicketProvider& ticketProvider_;
};
}
