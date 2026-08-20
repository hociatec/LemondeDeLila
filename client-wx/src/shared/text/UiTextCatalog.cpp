#include "shared/text/UiTextCatalog.h"

#include <array>
#include <filesystem>
#include <fstream>

#include <nlohmann/json.hpp>
#include <wx/stdpaths.h>

#include "shared/logging/Logger.h"

namespace lila::shared::text::ui
{
namespace
{
constexpr std::size_t UiTextCount = static_cast<std::size_t>(UiTextKey::Count);

[[nodiscard]] std::size_t ToIndex(UiTextKey key) noexcept
{
    return static_cast<std::size_t>(key);
}

[[nodiscard]] std::array<std::string, UiTextCount> BuildDefaultTexts()
{
    std::array<std::string, UiTextCount> texts{};
    std::size_t index = 0;
#define LILA_UI_TEXT(name, value) texts[index++] = value;
#include "shared/text/UiTextKeys.def"
#undef LILA_UI_TEXT
    return texts;
}

[[nodiscard]] std::filesystem::path ResolveResourcePath()
{
    const auto executableDirectory = std::filesystem::path(wxStandardPaths::Get().GetExecutablePath().ToStdWstring()).parent_path();
    const std::array<std::filesystem::path, 4> candidates = {
        std::filesystem::current_path() / "resources" / "texts.fr.json",
        std::filesystem::current_path() / "texts.fr.json",
        executableDirectory / "resources" / "texts.fr.json",
        executableDirectory / "texts.fr.json"};

    for (const auto& candidate : candidates)
    {
        std::error_code errorCode;
        if (std::filesystem::exists(candidate, errorCode))
        {
            return candidate;
        }
    }

    return {};
}

[[nodiscard]] std::array<std::string, UiTextCount> LoadTexts()
{
    auto texts = BuildDefaultTexts();
    const auto path = ResolveResourcePath();
    if (path.empty())
    {
        return texts;
    }

    try
    {
        std::ifstream file(path, std::ios::binary);
        if (!file.is_open())
        {
            return texts;
        }

        nlohmann::json document;
        file >> document;
        if (!document.is_object())
        {
            return texts;
        }

#define LILA_UI_TEXT(name, value)                                                                                         \
    do                                                                                                                    \
    {                                                                                                                     \
        const auto iterator = document.find(#name);                                                                       \
        if (iterator != document.end() && iterator->is_string())                                                          \
        {                                                                                                                 \
            texts[ToIndex(UiTextKey::name)] = iterator->get<std::string>();                                               \
        }                                                                                                                 \
    } while (false);
#include "shared/text/UiTextKeys.def"
#undef LILA_UI_TEXT
    }
    catch (const std::exception& exception)
    {
        lila::shared::logging::LogWarning("UiTexts", std::string("Chargement des textes externes ignoré: ") + exception.what());
    }

    return texts;
}

struct UiTextCatalog final
{
    std::array<std::string, UiTextCount> texts = LoadTexts();
};

UiTextCatalog& Catalog()
{
    static UiTextCatalog catalog;
    return catalog;
}
}

const std::string& GetText(UiTextKey key)
{
    return Catalog().texts[ToIndex(key)];
}

const std::string& UiTextRef::str() const
{
    return GetText(key_);
}

const char* UiTextRef::data() const
{
    return str().c_str();
}

UiTextRef::operator std::string_view() const
{
    return str();
}

UiTextRef::operator std::string() const
{
    return str();
}

UiTextRef::operator const char*() const
{
    return str().c_str();
}
}
