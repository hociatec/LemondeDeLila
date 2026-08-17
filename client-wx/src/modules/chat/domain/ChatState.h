#pragma once

namespace lila::modules::chat::domain
{
enum class ChatState
{
    Disconnected,
    Connecting,
    Reconnecting,
    Connected,
    Error,
};
}
