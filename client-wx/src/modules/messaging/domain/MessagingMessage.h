#pragma once

#include <ctime>
#include <string>

#include "modules/messaging/domain/MessagingUser.h"
#include "shared/domain/identifiers/DomainTypes.h"

namespace lila::modules::messaging::domain
{
struct MessagingMessage final
{
    lila::shared::domain::MessageId id;
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
