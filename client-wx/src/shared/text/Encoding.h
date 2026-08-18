#pragma once

#include <string>
#include <string_view>

#include <wx/string.h>

namespace lila::shared::text {

// Single UTF-8 boundary for the application.
// Domain, network and persistence strings are UTF-8 std::string values.
// wxWidgets strings are Unicode wxString values.
[[nodiscard]] wxString FromUtf8(std::string_view value);
[[nodiscard]] wxString FromUtf8(const char* value);
[[nodiscard]] std::string ToUtf8(const wxString& value);

[[nodiscard]] std::wstring Utf8ToWide(const std::string& value);

}
