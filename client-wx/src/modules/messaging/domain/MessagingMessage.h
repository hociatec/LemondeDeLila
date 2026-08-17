#pragma once

#include <ctime>
#include <string>

#include "modules/messaging/domain/MessagingUser.h"

namespace lila::modules::messaging::domain
{
struct MessagingMessage final
{
    std::string id;
    MessagingUser sender;
    MessagingUser recipient;
    std::string subject;
    std::string text;
    std::time_t createdAtUtc = 0;
    bool isSent = false;
    bool isDeleted = false;
    std::string boxType;
};
}
