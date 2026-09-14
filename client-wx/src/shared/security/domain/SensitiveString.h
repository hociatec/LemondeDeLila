#pragma once

#include <string>
#include <utility>

#include "shared/security/infrastructure/SecurityUtils.h"

namespace lila::shared::security
{
class SensitiveString final
{
public:
    explicit SensitiveString(std::string value) : value_(std::move(value)) {}
    ~SensitiveString() { SecureWipeString(value_); }

    SensitiveString(const SensitiveString&) = delete;
    SensitiveString& operator=(const SensitiveString&) = delete;
    SensitiveString(SensitiveString&&) = delete;
    SensitiveString& operator=(SensitiveString&&) = delete;

    [[nodiscard]] const std::string& Value() const noexcept { return value_; }

private:
    std::string value_;
};
}
