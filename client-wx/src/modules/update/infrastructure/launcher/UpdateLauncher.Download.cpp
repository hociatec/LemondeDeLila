#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>
#include <winhttp.h>

#include <array>
#include <algorithm>
#include <charconv>
#include <fstream>
#include <optional>
#include <stdexcept>
#include <nlohmann/json.hpp>
#include "modules/update/application/UpdateManifestDownload.h"
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

[[noreturn]] void ThrowWinHttpError(const char* operation)
{
    const DWORD code = GetLastError();
    throw std::runtime_error(
        std::string(operation) + " (WinHTTP error " + std::to_string(code) + ").");
}

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
void HttpGet(const std::string& url, std::uint64_t maximumBytes, Consumer&& consume,
    bool manifestRequest = false)
{
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(10);
    const auto parsed = ParseUrl(Widen(url));
    InternetHandle session{WinHttpOpen(L"LeMondeDeLilaUpdater/1.0",
        WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS, 0)};
    if (!session.value) ThrowWinHttpError("Unable to open HTTP session");
    // A small manifest must not delay startup like a large update package.
    if (!WinHttpSetTimeouts(session.value,
            manifestRequest ? 2000 : 10000, manifestRequest ? 2000 : 10000,
            manifestRequest ? 2000 : 15000, manifestRequest ? 3000 : 30000)) {
        ThrowWinHttpError("Unable to configure update timeouts");
    }
    InternetHandle connection{WinHttpConnect(session.value, parsed.host.c_str(), parsed.port, 0)};
    if (!connection.value) ThrowWinHttpError("Unable to connect to update server");
    InternetHandle request{WinHttpOpenRequest(connection.value, L"GET", parsed.path.c_str(),
        nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
        parsed.secure ? WINHTTP_FLAG_SECURE : 0)};
    if (!request.value || !WinHttpSendRequest(request.value, WINHTTP_NO_ADDITIONAL_HEADERS,
            0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) || !WinHttpReceiveResponse(request.value, nullptr)) {
        ThrowWinHttpError("Update request failed");
    }
    DWORD status = 0;
    DWORD size = sizeof(status);
    if (!WinHttpQueryHeaders(request.value,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX, &status, &size, WINHTTP_NO_HEADER_INDEX)) {
        ThrowWinHttpError("Unable to read update response status");
    }
    if (status != 200) {
        throw std::runtime_error(
            "Update server returned HTTP status " + std::to_string(status) + ".");
    }
    std::optional<std::uint64_t> contentLength;
    std::array<wchar_t, 32> lengthHeader{};
    size = sizeof(lengthHeader);
    if (WinHttpQueryHeaders(request.value,
            WINHTTP_QUERY_CONTENT_LENGTH,
            WINHTTP_HEADER_NAME_BY_INDEX, lengthHeader.data(), &size,
            WINHTTP_NO_HEADER_INDEX)) {
        const auto text = Narrow(lengthHeader.data());
        std::uint64_t length = 0;
        const auto parsedLength = std::from_chars(text.data(), text.data() + text.size(), length);
        if (parsedLength.ec != std::errc{} || parsedLength.ptr != text.data() + text.size())
            throw std::runtime_error("Invalid update response Content-Length.");
        contentLength = length;
        if (length > maximumBytes)
            throw std::runtime_error("Update response exceeds its declared limit.");
    } else if (GetLastError() != ERROR_WINHTTP_HEADER_NOT_FOUND) {
        ThrowWinHttpError("Unable to read update response length");
    }
    std::array<char, 64 * 1024> buffer{};
    std::uint64_t total = 0;
    while (true) {
        DWORD bytesToRead = static_cast<DWORD>(buffer.size());
        if (manifestRequest) {
            const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(
                deadline - std::chrono::steady_clock::now()).count();
            if (remaining <= 0)
                throw std::runtime_error("Update manifest download exceeded its time limit.");
            // Bound the whole body transfer, including a server sending a slow trickle.
            if (!WinHttpSetTimeouts(request.value, 2000, 2000, 2000,
                    static_cast<int>(std::min<std::int64_t>(remaining, 3000))))
                ThrowWinHttpError("Unable to configure update read timeout");
            // ReadData otherwise waits to fill the buffer, which a trickling
            // response can keep open indefinitely despite an idle timeout.
            DWORD available = 0;
            if (!WinHttpQueryDataAvailable(request.value, &available))
                ThrowWinHttpError("Update download was interrupted");
            bytesToRead = available == 0 ? 1 : std::min(available, bytesToRead);
        }
        DWORD read = 0;
        if (!WinHttpReadData(request.value, buffer.data(), bytesToRead, &read)) {
            ThrowWinHttpError("Update download was interrupted");
        }
        if (read == 0) break;
        total += read;
        if (total > maximumBytes) {
            throw std::runtime_error("Update response exceeded its declared limit.");
        }
        consume(buffer.data(), read);
    }
    if (contentLength && total != *contentLength)
        throw std::runtime_error("Update response was truncated (Content-Length mismatch).");
}

std::string DownloadText(const std::string& url)
{
    return DownloadUpdateManifestWithRetry(
        [&url] {
            std::string result;
            HttpGet(url, 1024 * 1024, [&result](const char* data, DWORD size) {
                result.append(data, size);
            }, true);
            // An interrupted response can also omit Content-Length entirely.
            // Validate syntax inside the retry boundary; signature checks stay in ParseManifest.
            if (result.find_first_not_of(" \t\r\n") != std::string::npos &&
                !nlohmann::json::accept(result))
                throw std::runtime_error("Update server returned an invalid JSON manifest.");
            return result;
        },
        [](std::chrono::milliseconds delay) { static_cast<void>(WaitForRetry(delay)); });
}

void DownloadFile(
    const std::string& url,
    const fs::path& destination,
    std::uint64_t expectedBytes,
    UpdateProgressDialog* progress)
{
    fs::create_directories(destination.parent_path());
    const fs::path partial = destination.wstring() + L".partial";
    std::string lastFailure;
    for (int attempt = 1; attempt <= 3; ++attempt) {
        fs::remove(partial);
        try {
            if (progress) progress->ThrowIfCancelled();
            if (progress && attempt > 1) {
                progress->SetStage(L"Nouvelle tentative de téléchargement…", 5);
            }
            std::ofstream output(partial, std::ios::binary | std::ios::trunc);
            if (!output) throw std::runtime_error("Unable to create update download.");
            std::uint64_t written = 0;
            HttpGet(url, expectedBytes, [&output, &written, progress, expectedBytes](
                    const char* data, DWORD size) {
                if (progress) progress->ThrowIfCancelled();
                output.write(data, size);
                if (!output) throw std::runtime_error("Unable to save update download.");
                written += size;
                if (progress) progress->SetDownloadProgress(written, expectedBytes);
            });
            output.flush();
            if (!output || written != expectedBytes) {
                throw std::runtime_error("Downloaded update size does not match its manifest.");
            }
            output.close();
            if (!MoveFileExW(partial.c_str(), destination.c_str(),
                    MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
                throw std::runtime_error(
                    "Unable to commit update download (Windows error " +
                    std::to_string(GetLastError()) + ").");
            }
            return;
        } catch (const std::exception& error) {
            fs::remove(partial);
            if (progress && progress->Cancelled())
                throw std::runtime_error("Update cancelled by user.");
            lastFailure = error.what();
            if (attempt < 3 && !WaitForRetry(
                    std::chrono::milliseconds(500 * attempt), progress))
                throw std::runtime_error("Update cancelled by user.");
        }
    }
    throw std::runtime_error(
        "Update package download failed after 3 attempts. Last error: " + lastFailure);
}
}
