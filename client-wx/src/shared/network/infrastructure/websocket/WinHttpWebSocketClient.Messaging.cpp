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
    const auto operation = BeginOperation(false);
    if (operation.handle == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::WinHttpNoActiveConnection);
    }

    const auto rawPayload = reinterpret_cast<const BYTE*>(payload.data());
    const DWORD sendResult = WinHttpWebSocketSend(
        operation.handle,
        WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,
        const_cast<BYTE*>(rawPayload),
        static_cast<DWORD>(payload.size()));
    EndOperation(operation);
    if (sendResult != NO_ERROR)
    {
        CancelIfCurrent(operation.generation);
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
    const auto operation = BeginOperation(true);
    if (operation.handle == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::WinHttpNoActiveConnection);
    }

    try
    {
        auto message = detail::ReceiveMessage(operation.handle);
        EndOperation(operation);
        return message;
    }
    catch (...)
    {
        EndOperation(operation);
        CancelIfCurrent(operation.generation);
        throw;
    }
#else
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}
}
