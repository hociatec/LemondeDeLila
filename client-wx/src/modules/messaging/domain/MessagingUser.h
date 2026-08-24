#pragma once

#include "shared/domain/identifiers/DomainTypes.h"

namespace lila::modules::messaging::domain
{
struct MessagingUser final
{
    lila::shared::domain::UserId id{};
    std::string username;
};
}
