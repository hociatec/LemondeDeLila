#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.NativeState.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketInternals.h"
#include "shared/errors/catalog/ErrorMessages.h"

#include <stdexcept>
#include <string>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <winhttp.h>
#endif

namespace lila::shared::network::websocket
{
void WinHttpWebSocketClient::Send(const std::string& payload)
{
#ifdef _WIN32
    if (!IsConnected())
    {
        throw std::runtime_error(lila::shared::errors::WinHttpNoActiveConnection);
    }

    const auto rawPayload = reinterpret_cast<const BYTE*>(payload.data());
    const DWORD sendResult = WinHttpWebSocketSend(
        state_->webSocket.Get(),
        WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,
        const_cast<BYTE*>(rawPayload),
        static_cast<DWORD>(payload.size()));
    if (sendResult != NO_ERROR)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(
            lila::shared::errors::RealtimeSendFailed,
            "code WinHTTP " + std::to_string(sendResult)));
    }
#else
    (void)payload;
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}

std::string WinHttpWebSocketClient::Receive()
{
#ifdef _WIN32
    if (!IsConnected())
    {
        throw std::runtime_error(lila::shared::errors::WinHttpNoActiveConnection);
    }

    try
    {
        return detail::ReceiveMessage(state_->webSocket.Get());
    }
    catch (const std::exception& exception)
    {
        (void)exception;
        Close();
        throw;
    }
#else
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}
}

