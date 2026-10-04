#pragma once

#include <string_view>

namespace lila::modules::admin::presentation
{
[[nodiscard]] constexpr bool ShouldCopyContextValue(
    std::string_view commandId,
    std::string_view fieldName) noexcept
{
    // A report and a new comment both expose a field named "content", but
    // their values are unrelated. A comment must always start empty.
    return commandId != "bugs.comment" || fieldName != "content";
}
}
