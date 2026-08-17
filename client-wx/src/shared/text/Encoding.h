#pragma once

#include <string>

namespace lila::shared::text {

[[nodiscard]] std::wstring Utf8ToWide(const std::string& value);

}
