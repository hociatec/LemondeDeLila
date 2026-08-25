#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <winhttp.h>

#include <array>
#include <fstream>
#include <stdexcept>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
struct InternetHandle
{
    HINTERNET value = nullptr;
    ~InternetHandle() { if (value) WinHttpCloseHandle(value); }
};

struct ParsedUrl
{
    std::wstring host;
    std::wstring path;
    INTERNET_PORT port = 0;
    bool secure = false;
};

ParsedUrl ParseUrl(const std::wstring& raw)
{
    URL_COMPONENTS components{};
    components.dwStructSize = sizeof(components);
    components.dwHostNameLength = static_cast<DWORD>(-1);
    components.dwUrlPathLength = static_cast<DWORD>(-1);
    components.dwExtraInfoLength = static_cast<DWORD>(-1);
    if (!WinHttpCrackUrl(raw.c_str(), 0, 0, &components)) {
        throw std::runtime_error("Invalid update URL.");
    }
    ParsedUrl result;
    result.host.assign(components.lpszHostName, components.dwHostNameLength);
    result.path.assign(components.lpszUrlPath, components.dwUrlPathLength);
    if (components.dwExtraInfoLength > 0) {
        result.path.append(components.lpszExtraInfo, components.dwExtraInfoLength);
    }
    result.port = components.nPort;
    result.secure = components.nScheme == INTERNET_SCHEME_HTTPS;
    if (!result.secure && result.host != L"127.0.0.1" && result.host != L"localhost") {
        throw std::runtime_error("Update URL must use HTTPS.");
    }
    return result;
}

template <typename Consumer>
void HttpGet(const std::string& url, std::uint64_t maximumBytes, Consumer&& consume)
{
    const auto parsed = ParseUrl(Widen(url));
    InternetHandle session{WinHttpOpen(L"LeMondeDeLilaUpdater/1.0",
        WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS, 0)};
    if (!session.value) throw std::runtime_error("Unable to open HTTP session.");
    WinHttpSetTimeouts(session.value, 10000, 10000, 15000, 30000);
    InternetHandle connection{WinHttpConnect(session.value, parsed.host.c_str(), parsed.port, 0)};
    if (!connection.value) throw std::runtime_error("Unable to connect to update server.");
    InternetHandle request{WinHttpOpenRequest(connection.value, L"GET", parsed.path.c_str(),
        nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
        parsed.secure ? WINHTTP_FLAG_SECURE : 0)};
    if (!request.value || !WinHttpSendRequest(request.value, WINHTTP_NO_ADDITIONAL_HEADERS,
            0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) || !WinHttpReceiveResponse(request.value, nullptr)) {
        throw std::runtime_error("Update request failed.");
    }
    DWORD status = 0;
    DWORD size = sizeof(status);
    WinHttpQueryHeaders(request.value, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
        WINHTTP_HEADER_NAME_BY_INDEX, &status, &size, WINHTTP_NO_HEADER_INDEX);
    if (status != 200) throw std::runtime_error("Update server returned an error.");
    DWORD contentLength = 0;
    size = sizeof(contentLength);
    if (WinHttpQueryHeaders(request.value,
            WINHTTP_QUERY_CONTENT_LENGTH | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX, &contentLength, &size,
            WINHTTP_NO_HEADER_INDEX) && contentLength > maximumBytes) {
        throw std::runtime_error("Update response exceeds its declared limit.");
    }
    std::array<char, 64 * 1024> buffer{};
    std::uint64_t total = 0;
    while (true) {
        DWORD read = 0;
        if (!WinHttpReadData(request.value, buffer.data(), static_cast<DWORD>(buffer.size()), &read)) {
            throw std::runtime_error("Update download was interrupted.");
        }
        if (read == 0) break;
        total += read;
        if (total > maximumBytes) {
            throw std::runtime_error("Update response exceeded its declared limit.");
        }
        consume(buffer.data(), read);
    }
}

std::string DownloadText(const std::string& url)
{
    std::string result;
    HttpGet(url, 1024 * 1024, [&result](const char* data, DWORD size) {
        result.append(data, size);
    });
    return result;
}

void DownloadFile(
    const std::string& url,
    const fs::path& destination,
    std::uint64_t expectedBytes)
{
    fs::create_directories(destination.parent_path());
    const fs::path partial = destination.wstring() + L".partial";
    fs::remove(partial);
    try {
        std::ofstream output(partial, std::ios::binary | std::ios::trunc);
        if (!output) throw std::runtime_error("Unable to create update download.");
        std::uint64_t written = 0;
        HttpGet(url, expectedBytes, [&output, &written](const char* data, DWORD size) {
            output.write(data, size);
            if (!output) throw std::runtime_error("Unable to save update download.");
            written += size;
        });
        output.flush();
        if (!output || written != expectedBytes) {
            throw std::runtime_error("Downloaded update size does not match its manifest.");
        }
        output.close();
        if (!MoveFileExW(partial.c_str(), destination.c_str(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            throw std::runtime_error("Unable to commit update download.");
        }
    } catch (...) {
        fs::remove(partial);
        throw;
    }
}
}
