#pragma once

#include <string>
#include <utility>

namespace lila::modules::admin::domain
{
class AdminPayload final
{
public:
    explicit AdminPayload(std::string serialized = "{}")
        : serialized_(std::move(serialized))
    {
    }

    [[nodiscard]] const std::string& Serialized() const noexcept
    {
        return serialized_;
    }

private:
    std::string serialized_;
};
}
