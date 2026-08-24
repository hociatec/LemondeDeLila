#pragma once

#include <string>
#include <string_view>

namespace lila::shared::text::ui
{
enum class UiTextKey
{
#define LILA_UI_TEXT(name, value) name,
#include "shared/text/presentation/catalog/UiTextKeys.def"
#undef LILA_UI_TEXT
    Count
};

class UiTextRef final
{
public:
    constexpr explicit UiTextRef(UiTextKey key) noexcept : key_(key) {}

    [[nodiscard]] const std::string& str() const;
    [[nodiscard]] const char* data() const;

    [[nodiscard]] operator std::string_view() const;
    [[nodiscard]] operator std::string() const;
    [[nodiscard]] operator const char*() const;

private:
    UiTextKey key_;
};

[[nodiscard]] const std::string& GetText(UiTextKey key);
}
