#pragma once

#include <string>

namespace lila::modules::messaging::domain
{
struct MessagingUser final
{
    int id = 0;
    std::string username;
};
}
