#pragma once

#include <stdexcept>
#include <string>

namespace lila::modules::gameplay::domain
{
class GameProtocolException final : public std::runtime_error
{
public:
    explicit GameProtocolException(std::string detail)
        : std::runtime_error(std::move(detail))
    {
    }
};
}
