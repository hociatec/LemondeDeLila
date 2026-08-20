#pragma once

#include "shared/domain/DomainTypes.h"

namespace lila::modules::messaging::domain
{
struct MessagingUser final
{
    lila::shared::domain::UserId id{};
    std::string username;
};
}
