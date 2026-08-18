#include "shared/text/Encoding.h"
#include "shared/errors/ErrorMessages.h"

#ifdef _WIN32
#include <windows.h>
#endif

#include <stdexcept>

namespace lila::shared::text {

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
    return converted;
}

wxString FromUtf8(const char* value)
{
    if (value == nullptr || *value == '\0')
    {
        return {};
    }
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
