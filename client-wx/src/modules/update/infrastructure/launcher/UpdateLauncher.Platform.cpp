#include <limits>
#include <stdexcept>
#include <string>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
std::wstring Widen(const std::string& value)
{
    if (value.empty()) return {};
    if (value.size() > static_cast<std::size_t>(std::numeric_limits<int>::max()))
        throw std::length_error("UTF-8 input is too long for Win32.");
    const auto inputLength = static_cast<int>(value.size());
    const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
        inputLength, nullptr, 0);
    if (count <= 0) throw std::runtime_error("Invalid UTF-8 string.");
    std::wstring result(static_cast<std::size_t>(count), L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
        inputLength, result.data(), count);
    return result;
}

std::string Narrow(const std::wstring& value)
{
    if (value.empty()) return {};
    if (value.size() > static_cast<std::size_t>(std::numeric_limits<int>::max()))
        throw std::length_error("Wide input is too long for Win32.");
    const auto inputLength = static_cast<int>(value.size());
    const int count = WideCharToMultiByte(CP_UTF8, 0, value.data(),
        inputLength, nullptr, 0, nullptr, nullptr);
    if (count <= 0) throw std::runtime_error("Unable to encode UTF-8 string.");
    std::string result(static_cast<std::size_t>(count), '\0');
    if (WideCharToMultiByte(CP_UTF8, 0, value.data(), inputLength,
            result.data(), count, nullptr, nullptr) != count)
        throw std::runtime_error("Unable to encode UTF-8 string.");
    return result;
}

std::string Environment(const wchar_t* name)
{
    const DWORD required = GetEnvironmentVariableW(name, nullptr, 0);
    if (required == 0) return {};
    std::wstring value(required, L'\0');
    const DWORD written = GetEnvironmentVariableW(name, value.data(), required);
    if (written == 0) return {};
    value.resize(written);
    return Narrow(value);
}

bool AllowUnsignedUpdates()
{
#ifdef NDEBUG
    return false;
#else
    const auto value = Environment(L"LILA_ALLOW_UNSIGNED_UPDATES");
    return value == "1" || value == "true";
#endif
}

fs::path ExecutablePath()
{
    std::wstring buffer(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(),
        static_cast<DWORD>(buffer.size()));
    if (length == 0 || length >= buffer.size()) {
        throw std::runtime_error("Unable to resolve launcher path.");
    }
    buffer.resize(length);
    return fs::weakly_canonical(buffer);
}
}
