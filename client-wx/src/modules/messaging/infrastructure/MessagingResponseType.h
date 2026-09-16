#pragma once
#include <string>
#include <string_view>
#include "shared/network/domain/WsMessageTypes.h"

namespace lila::modules::messaging::infrastructure
{
inline std::string MessagingResponseType(std::string_view request)
{
    namespace types = lila::shared::network::ws::types::messaging;
    if (request == types::Search) return std::string(types::User);
    if (request == types::Send) return std::string(types::MessageSent);
    if (request == types::Delete) return std::string(types::MessageDeleted);
    if (request == types::Restore) return std::string(types::MessageRestored);
    if (request == types::Purge) return std::string(types::MessagePurged);
    return std::string(request);
}
}
