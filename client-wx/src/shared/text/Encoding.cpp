#include "shared/text/Encoding.h"
#include "shared/errors/ErrorMessages.h"

#ifdef _WIN32
#include <windows.h>
#endif

#include <stdexcept>

namespace lila::shared::text {

std::wstring Utf8ToWide(const std::string& value)
{
#ifdef _WIN32
    if (value.empty())
    {
        return {};
    }

    const int size = MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, nullptr, 0);
    if (size <= 0)
    {
        throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);
    }

    std::wstring converted(static_cast<std::size_t>(size), L'\0');
    if (MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, converted.data(), size) <= 0)
    {
        throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);
    }

    converted.resize(static_cast<std::size_t>(size - 1));
    return converted;
#else
    (void)value;
    throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionNotSupported);
#endif
}

}
