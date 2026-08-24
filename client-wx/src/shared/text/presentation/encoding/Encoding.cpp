#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/errors/catalog/ErrorMessages.h"

#ifdef _WIN32
#include <windows.h>
#endif

#include <stdexcept>
#include <atomic>

namespace lila::shared::text {
namespace
{
std::atomic_bool repairBrokenAccentsEnabled{true};
}

wxString FromUtf8(std::string_view value)
{
    if (value.empty())
    {
        return {};
    }

    const wxString converted = wxString::FromUTF8(value.data(), value.size());
    if (converted.empty() && !value.empty())
    {
        throw std::runtime_error(lila::shared::errors::Utf8DecodeFailed);
    }
    return repairBrokenAccentsEnabled.load(std::memory_order_relaxed)
        ? RepairBrokenAccents(converted)
        : converted;
}

wxString FromUtf8(const char* value)
{
    if (value == nullptr || *value == '\0')
    {
        return {};
    }
    return FromUtf8(std::string_view(value));
}

wxString FromUtf8(const lila::shared::text::ui::UiTextRef& value)
{
    return FromUtf8(std::string_view(value));
}

std::string ToUtf8(const wxString& value)
{
    if (value.empty())
    {
        return {};
    }

    const wxScopedCharBuffer converted = value.ToUTF8();
    if (!converted)
    {
        throw std::runtime_error(lila::shared::errors::Utf8EncodeFailed);
    }
    return std::string(converted.data(), converted.length());
}

void SetBrokenAccentRepairEnabled(bool enabled) noexcept
{
    repairBrokenAccentsEnabled.store(enabled, std::memory_order_relaxed);
}

bool IsBrokenAccentRepairEnabled() noexcept
{
    return repairBrokenAccentsEnabled.load(std::memory_order_relaxed);
}

wxString RepairBrokenAccents(const wxString& value)
{
    wxString repaired = value;
    const std::pair<const wchar_t*, const wchar_t*> replacements[] = {
        {L"Ã€", L"À"}, {L"Ã‚", L"Â"}, {L"Ã„", L"Ä"}, {L"Ã‡", L"Ç"},
        {L"Ãˆ", L"È"}, {L"Ã‰", L"É"}, {L"ÃŠ", L"Ê"}, {L"Ã‹", L"Ë"},
        {L"ÃŽ", L"Î"}, {L"Ã", L"Ï"}, {L"Ã”", L"Ô"}, {L"Ã–", L"Ö"},
        {L"Ã™", L"Ù"}, {L"Ã›", L"Û"}, {L"Ãœ", L"Ü"},
        {L"Ã©", L"é"}, {L"Ã¨", L"è"}, {L"Ãª", L"ê"}, {L"Ã«", L"ë"},
        {L"Ã ", L"à"}, {L"Ã¡", L"á"}, {L"Ã¢", L"â"}, {L"Ã¤", L"ä"},
        {L"Ã§", L"ç"}, {L"Ã¬", L"ì"}, {L"Ã­", L"í"}, {L"Ã®", L"î"},
        {L"Ã¯", L"ï"}, {L"Ã²", L"ò"}, {L"Ã³", L"ó"}, {L"Ã´", L"ô"},
        {L"Ã¶", L"ö"}, {L"Ã¹", L"ù"}, {L"Ãº", L"ú"}, {L"Ã»", L"û"},
        {L"Ã¼", L"ü"}, {L"Å“", L"œ"}, {L"Å’", L"Œ"},
        {L"â€™", L"’"}, {L"â€œ", L"“"}, {L"â€", L"”"}, {L"â€“", L"–"},
        {L"â€”", L"—"}, {L"â€¦", L"…"}, {L"Â ", L" "}};
    for (const auto& [broken, correct] : replacements)
    {
        repaired.Replace(broken, correct, true);
    }
    return repaired;
}

std::wstring Utf8ToWide(const std::string& value)
{
#ifdef _WIN32
    if (value.empty())
    {
        return {};
    }

    const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.c_str(), -1, nullptr, 0);
    if (size <= 0)
    {
        throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);
    }

    std::wstring converted(static_cast<std::size_t>(size), L'\0');
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.c_str(), -1, converted.data(), size) <= 0)
    {
        throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);
    }

    converted.resize(static_cast<std::size_t>(size - 1));
    return converted;
#else
    return FromUtf8(value).ToStdWstring();
#endif
}

}
