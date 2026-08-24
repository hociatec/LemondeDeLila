#pragma once

#include <cstddef>

#include <wx/string.h>

#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/text/presentation/catalog/UiTextCatalog.h"

namespace lila::shared::text
{
[[nodiscard]] inline wxString BuildCountStatus(
    std::size_t count,
    const lila::shared::text::ui::UiTextRef& emptyText,
    const lila::shared::text::ui::UiTextRef& countFormat)
{
    return count == 0
        ? FromUtf8(emptyText)
        : wxString::Format(FromUtf8(countFormat), count);
}
}
