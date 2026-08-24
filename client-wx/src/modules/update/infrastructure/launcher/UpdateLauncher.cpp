#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <bcrypt.h>
#include <wincrypt.h>
#include <winhttp.h>
#include <wintrust.h>
#include <softpub.h>
#include <shellapi.h>

#include <nlohmann/json.hpp>

#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <limits>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "UpdateBuildConfig.h"
#include "modules/update/domain/UpdateProtocol.h"
#include "modules/update/infrastructure/launcher/UpdateLauncher.h"

namespace
{
namespace fs = std::filesystem;
using json = nlohmann::json;
using Manifest = lila::modules::update::UpdateManifest;
using lila::modules::update::CanonicalUpdateSignature;
using lila::modules::update::IsSafeReleaseId;
using lila::modules::update::IsUpdateNewer;
using lila::modules::update::ParseUpdateManifest;
using lila::modules::update::ParseUpdateVersion;

constexpr wchar_t AppExecutable[] = L"lemonde_de_lila_wx.exe";
constexpr wchar_t LauncherExecutable[] = L"lila_launcher.exe";
constexpr wchar_t LauncherMutex[] = L"Local\\LeMondeDeLilaWX.Launcher";
constexpr auto PollInterval = std::chrono::seconds(120);
constexpr std::uint64_t MinimumFreeSpaceReserve = 128ULL * 1024ULL * 1024ULL;
constexpr std::uint64_t MaximumArchiveEntries = 20'000;
constexpr std::uint64_t MaximumExtractedBytes = 8ULL * 1024ULL * 1024ULL * 1024ULL;

struct State
{
    std::string currentVersion;
    std::string currentReleaseId;
    std::string previousVersion;
    std::string previousReleaseId;
    std::string retainedReleaseId;
    std::string failedReleaseId;
    std::string failedVersion;
    std::string requiredVersion;
    std::uint64_t highestSequence = 0;
};

std::wstring Widen(const std::string& value)
{
    if (value.empty()) return {};
    const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), nullptr, 0);
    if (count <= 0) throw std::runtime_error("Invalid UTF-8 string.");
    std::wstring result(static_cast<std::size_t>(count), L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), result.data(), count);
    return result;
}

std::string Narrow(const std::wstring& value)
{
    if (value.empty()) return {};
    const int count = WideCharToMultiByte(CP_UTF8, 0, value.data(),
        static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    std::string result(static_cast<std::size_t>(count), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()),
        result.data(), count, nullptr, nullptr);
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

fs::path StatePath(const fs::path& root) { return root / L"state" / L"current.json"; }
fs::path ReleasePath(const fs::path& root, const std::string& releaseId)
{
    if (!IsSafeReleaseId(releaseId)) throw std::runtime_error("Unsafe update release identifier.");
    const fs::path versions = fs::weakly_canonical(root) / L"versions";
    const fs::path candidate = versions / Widen(releaseId);
    if (candidate.parent_path().lexically_normal() != versions.lexically_normal()) {
        throw std::runtime_error("Update release path escaped its root.");
    }
    return candidate;
}

void AppendLog(const fs::path& root, const char* level, const std::string& message) noexcept
{
    try {
        fs::create_directories(root / L"state");
        const fs::path logPath = root / L"state" / L"update.log";
        if (fs::exists(logPath) && fs::file_size(logPath) > 5ULL * 1024ULL * 1024ULL) {
            const fs::path previous = root / L"state" / L"update.log.1";
            fs::remove(previous);
            fs::rename(logPath, previous);
        }
        SYSTEMTIME now{};
        GetSystemTime(&now);
        std::ofstream output(logPath, std::ios::app | std::ios::binary);
        output << std::setfill('0') << std::setw(4) << now.wYear << '-'
            << std::setw(2) << now.wMonth << '-' << std::setw(2) << now.wDay << 'T'
            << std::setw(2) << now.wHour << ':' << std::setw(2) << now.wMinute << ':'
            << std::setw(2) << now.wSecond << 'Z' << " [" << level << "] " << message << '\n';
    } catch (...) {
    }
}

void WriteTextAtomic(const fs::path& path, const std::string& text)
{
    fs::create_directories(path.parent_path());
    const auto temporary = path.wstring() + L".tmp";
    {
        std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
        if (!output) throw std::runtime_error("Unable to write updater state.");
        output.write(text.data(), static_cast<std::streamsize>(text.size()));
        output.flush();
        if (!output) throw std::runtime_error("Unable to flush updater state.");
    }
    const auto backup = path.wstring() + L".bak";
    DeleteFileW(backup.c_str());
    const BOOL committed = fs::exists(path)
        ? ReplaceFileW(path.c_str(), temporary.c_str(), backup.c_str(),
              REPLACEFILE_WRITE_THROUGH, nullptr, nullptr)
        : MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_WRITE_THROUGH);
    if (!committed) {
        DeleteFileW(temporary.c_str());
        throw std::runtime_error("Unable to commit updater state.");
    }
}

State ReadState(const fs::path& root)
{
    State state;
    auto read = [&state](const fs::path& path) {
        std::ifstream input(path, std::ios::binary);
        if (!input) return false;
        const auto value = json::parse(input);
        state.currentVersion = value.value("currentVersion", "");
        state.currentReleaseId = value.value("currentReleaseId", "");
        state.previousVersion = value.value("previousVersion", "");
        state.previousReleaseId = value.value("previousReleaseId", "");
        state.retainedReleaseId = value.value("retainedReleaseId", "");
        state.failedReleaseId = value.value("failedReleaseId", "");
        state.failedVersion = value.value("failedVersion", "");
        state.requiredVersion = value.value("requiredVersion", "");
        state.highestSequence = value.value("highestSequence", std::uint64_t{});
        return true;
    };
    try {
        if (!read(StatePath(root))) return state;
    } catch (...) {
        try {
            if (!read(StatePath(root).wstring() + L".bak")) {
                throw std::runtime_error("Updater state is corrupted.");
            }
            AppendLog(root, "WARN", "Recovered updater state from backup.");
        } catch (...) {
            throw std::runtime_error("Updater state and backup are corrupted.");
        }
    }
    return state;
}

void SaveState(const fs::path& root, const State& state)
{
    WriteTextAtomic(StatePath(root), json{
        {"schemaVersion", 1},
        {"currentVersion", state.currentVersion},
        {"currentReleaseId", state.currentReleaseId},
        {"previousVersion", state.previousVersion},
        {"previousReleaseId", state.previousReleaseId},
        {"retainedReleaseId", state.retainedReleaseId},
        {"failedReleaseId", state.failedReleaseId},
        {"failedVersion", state.failedVersion},
        {"requiredVersion", state.requiredVersion},
        {"highestSequence", state.highestSequence},
    }.dump(2));
}

bool DeadlineReached(const std::string& value)
{
    if (value.empty()) return false;
    SYSTEMTIME deadline{};
    int milliseconds = 0;
    if (sscanf_s(value.c_str(), "%hu-%hu-%huT%hu:%hu:%hu.%dZ",
            &deadline.wYear, &deadline.wMonth, &deadline.wDay,
            &deadline.wHour, &deadline.wMinute, &deadline.wSecond,
            &milliseconds) != 7 || milliseconds < 0 || milliseconds > 999) {
        throw std::runtime_error("Invalid mandatory update date.");
    }
    deadline.wMilliseconds = static_cast<WORD>(milliseconds);
    FILETIME deadlineFileTime{};
    FILETIME now{};
    if (!SystemTimeToFileTime(&deadline, &deadlineFileTime)) {
        throw std::runtime_error("Invalid mandatory update date.");
    }
    GetSystemTimeAsFileTime(&now);
    return CompareFileTime(&now, &deadlineFileTime) >= 0;
}

std::string RequiredVersion(const Manifest& manifest)
{
    std::string required = manifest.minimumVersion;
    if (DeadlineReached(manifest.mandatoryAt) &&
        (required.empty() || IsUpdateNewer(manifest.version, required))) {
        required = manifest.version;
    }
    return required;
}

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

std::string Sha256(const fs::path& path)
{
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    DWORD objectLength = 0;
    DWORD copied = 0;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) != 0 ||
        BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
            reinterpret_cast<PUCHAR>(&objectLength), sizeof(objectLength), &copied, 0) != 0) {
        if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
        throw std::runtime_error("Unable to initialize SHA-256.");
    }
    std::vector<UCHAR> object(objectLength);
    std::array<UCHAR, 32> digest{};
    if (BCryptCreateHash(algorithm, &hash, object.data(), objectLength, nullptr, 0, 0) != 0) {
        BCryptCloseAlgorithmProvider(algorithm, 0);
        throw std::runtime_error("Unable to create SHA-256 hash.");
    }
    std::ifstream input(path, std::ios::binary);
    std::array<char, 64 * 1024> buffer{};
    while (input) {
        input.read(buffer.data(), buffer.size());
        const auto count = input.gcount();
        if (count > 0 && BCryptHashData(hash, reinterpret_cast<PUCHAR>(buffer.data()),
                static_cast<ULONG>(count), 0) != 0) {
            BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(algorithm, 0);
            throw std::runtime_error("Unable to hash update.");
        }
    }
    const auto status = BCryptFinishHash(
        hash,
        digest.data(),
        static_cast<ULONG>(digest.size()),
        0);
    BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    if (status != 0) throw std::runtime_error("Unable to finalize SHA-256.");
    static constexpr char Hex[] = "0123456789abcdef";
    std::string result;
    result.reserve(64);
    for (const auto byte : digest) { result.push_back(Hex[byte >> 4]); result.push_back(Hex[byte & 15]); }
    return result;
}

bool VerifyAuthenticode(const fs::path& executable)
{
    WINTRUST_FILE_INFO file{};
    file.cbStruct = sizeof(file);
    file.pcwszFilePath = executable.c_str();
    WINTRUST_DATA trust{};
    trust.cbStruct = sizeof(trust);
    trust.dwUIChoice = WTD_UI_NONE;
    trust.fdwRevocationChecks = WTD_REVOKE_NONE;
    trust.dwUnionChoice = WTD_CHOICE_FILE;
    trust.pFile = &file;
    trust.dwStateAction = WTD_STATEACTION_VERIFY;
    trust.dwProvFlags = WTD_CACHE_ONLY_URL_RETRIEVAL;
    GUID policy = WINTRUST_ACTION_GENERIC_VERIFY_V2;
    const LONG status = WinVerifyTrust(nullptr, &policy, &trust);
    trust.dwStateAction = WTD_STATEACTION_CLOSE;
    WinVerifyTrust(nullptr, &policy, &trust);
    return status == ERROR_SUCCESS;
}

std::vector<BYTE> DecodeBase64(const std::string& value)
{
    DWORD length = 0;
    if (value.empty() || !CryptStringToBinaryA(value.c_str(), 0,
            CRYPT_STRING_BASE64_ANY, nullptr, &length, nullptr, nullptr)) return {};
    std::vector<BYTE> bytes(length);
    if (!CryptStringToBinaryA(value.c_str(), 0, CRYPT_STRING_BASE64_ANY,
            bytes.data(), &length, nullptr, nullptr)) return {};
    bytes.resize(length);
    return bytes;
}

bool VerifyManifestSignature(const Manifest& manifest)
{
    const std::string publicKey = lila::modules::update::UpdateBuildConfig::PublicKeyDerBase64;
    if (publicKey.empty() || manifest.signature.empty()) return AllowUnsignedUpdates();
    auto keyDer = DecodeBase64(publicKey);
    auto signature = DecodeBase64(manifest.signature);
    if (keyDer.empty() || signature.empty()) return false;

    CERT_PUBLIC_KEY_INFO* keyInfo = nullptr;
    DWORD keyInfoSize = 0;
    if (!CryptDecodeObjectEx(X509_ASN_ENCODING, X509_PUBLIC_KEY_INFO,
            keyDer.data(), static_cast<DWORD>(keyDer.size()),
            CRYPT_DECODE_ALLOC_FLAG, nullptr, &keyInfo, &keyInfoSize)) return false;

    HCRYPTPROV provider = 0;
    HCRYPTKEY key = 0;
    HCRYPTHASH hash = 0;
    bool valid = false;
    if (CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_AES,
            CRYPT_VERIFYCONTEXT) &&
        CryptImportPublicKeyInfo(provider, X509_ASN_ENCODING, keyInfo, &key) &&
        CryptCreateHash(provider, CALG_SHA_256, 0, 0, &hash)) {
        const std::string canonical = CanonicalUpdateSignature(manifest);
        if (CryptHashData(hash, reinterpret_cast<const BYTE*>(canonical.data()),
                static_cast<DWORD>(canonical.size()), 0)) {
            // CryptoAPI RSA signatures are little-endian, unlike OpenSSL output.
            std::reverse(signature.begin(), signature.end());
            valid = CryptVerifySignatureA(hash, signature.data(),
                static_cast<DWORD>(signature.size()), key, nullptr, 0) == TRUE;
        }
    }
    if (hash) CryptDestroyHash(hash);
    if (key) CryptDestroyKey(key);
    if (provider) CryptReleaseContext(provider, 0);
    LocalFree(keyInfo);
    return valid;
}

Manifest ParseManifest(const std::string& raw)
{
    Manifest result = ParseUpdateManifest(raw);
    if (!result.mandatoryAt.empty()) static_cast<void>(DeadlineReached(result.mandatoryAt));
    if (!VerifyManifestSignature(result)) {
        throw std::runtime_error("Update manifest signature is invalid.");
    }
    return result;
}

std::string ManifestUrl(const std::string& currentVersion)
{
    std::string url = Environment(L"LILA_UPDATE_MANIFEST_URL");
    if (url.empty()) url = lila::modules::update::UpdateBuildConfig::DefaultManifestUrl;
    if (url.empty()) throw std::runtime_error("Update manifest URL is not configured.");
    url += url.find('?') == std::string::npos ? "?current=" : "&current=";
    url += currentVersion;
    return url;
}

std::wstring QuotePowerShellLiteral(const fs::path& path)
{
    std::wstring value = path.wstring();
    std::wstring escaped;
    for (const auto character : value) {
        escaped.push_back(character);
        if (character == L'\'') escaped.push_back(L'\'');
    }
    return L"'" + escaped + L"'";
}

std::uint16_t ReadUInt16(const std::vector<unsigned char>& bytes, std::size_t offset)
{
    if (offset + 2 > bytes.size()) throw std::runtime_error("Truncated ZIP metadata.");
    return static_cast<std::uint16_t>(bytes[offset]) |
        static_cast<std::uint16_t>(bytes[offset + 1] << 8);
}

std::uint32_t ReadUInt32(const std::vector<unsigned char>& bytes, std::size_t offset)
{
    if (offset + 4 > bytes.size()) throw std::runtime_error("Truncated ZIP metadata.");
    return static_cast<std::uint32_t>(bytes[offset]) |
        (static_cast<std::uint32_t>(bytes[offset + 1]) << 8) |
        (static_cast<std::uint32_t>(bytes[offset + 2]) << 16) |
        (static_cast<std::uint32_t>(bytes[offset + 3]) << 24);
}

bool IsSafeArchivePath(std::string value)
{
    if (value.empty() || value.front() == '/' || value.front() == '\\' ||
        value.find('\0') != std::string::npos ||
        (value.size() > 1 && value[1] == ':')) return false;
    std::replace(value.begin(), value.end(), '\\', '/');
    std::stringstream segments(value);
    std::string segment;
    while (std::getline(segments, segment, '/')) {
        if (segment == ".." || segment == ".") return false;
    }
    return true;
}

std::uint64_t InspectArchive(const fs::path& archive, std::uint64_t compressedBytes)
{
    std::ifstream input(archive, std::ios::binary);
    if (!input) throw std::runtime_error("Unable to inspect update archive.");
    const auto tailSize = static_cast<std::size_t>(std::min<std::uint64_t>(compressedBytes, 65'557));
    std::vector<unsigned char> tail(tailSize);
    input.seekg(static_cast<std::streamoff>(compressedBytes - tailSize));
    input.read(reinterpret_cast<char*>(tail.data()), static_cast<std::streamsize>(tail.size()));
    if (input.gcount() != static_cast<std::streamsize>(tail.size())) {
        throw std::runtime_error("Unable to read ZIP directory.");
    }
    std::optional<std::size_t> eocd;
    for (std::size_t offset = tail.size() >= 22 ? tail.size() - 22 : 0;;) {
        if (ReadUInt32(tail, offset) == 0x06054b50) { eocd = offset; break; }
        if (offset == 0) break;
        --offset;
    }
    if (!eocd) throw std::runtime_error("ZIP end directory is missing.");
    const auto entryCount = ReadUInt16(tail, *eocd + 10);
    const auto directorySize = ReadUInt32(tail, *eocd + 12);
    const auto directoryOffset = ReadUInt32(tail, *eocd + 16);
    if (entryCount == 0 || entryCount == 0xffff || entryCount > MaximumArchiveEntries ||
        directorySize > 64ULL * 1024ULL * 1024ULL ||
        static_cast<std::uint64_t>(directoryOffset) + directorySize > compressedBytes) {
        throw std::runtime_error("ZIP directory limits are invalid.");
    }
    std::vector<unsigned char> directory(directorySize);
    input.clear();
    input.seekg(directoryOffset);
    input.read(reinterpret_cast<char*>(directory.data()),
        static_cast<std::streamsize>(directory.size()));
    if (input.gcount() != static_cast<std::streamsize>(directory.size())) {
        throw std::runtime_error("ZIP directory is truncated.");
    }

    std::uint64_t extractedBytes = 0;
    std::size_t offset = 0;
    for (std::uint16_t index = 0; index < entryCount; ++index) {
        if (ReadUInt32(directory, offset) != 0x02014b50) {
            throw std::runtime_error("ZIP directory entry is invalid.");
        }
        const auto flags = ReadUInt16(directory, offset + 8);
        const auto unpacked = ReadUInt32(directory, offset + 24);
        const auto nameLength = ReadUInt16(directory, offset + 28);
        const auto extraLength = ReadUInt16(directory, offset + 30);
        const auto commentLength = ReadUInt16(directory, offset + 32);
        const auto attributes = ReadUInt32(directory, offset + 38);
        const auto next = offset + 46ULL + nameLength + extraLength + commentLength;
        if ((flags & 1U) != 0 || next > directory.size()) {
            throw std::runtime_error("Encrypted or truncated ZIP entry is not allowed.");
        }
        const std::string name(reinterpret_cast<const char*>(directory.data() + offset + 46),
            nameLength);
        const auto unixMode = (attributes >> 16) & 0xffffU;
        if (!IsSafeArchivePath(name) || (unixMode & 0170000U) == 0120000U) {
            throw std::runtime_error("Unsafe ZIP filesystem entry.");
        }
        if (extractedBytes > MaximumExtractedBytes - unpacked) {
            throw std::runtime_error("Uncompressed update exceeds its safety limit.");
        }
        extractedBytes += unpacked;
        offset = static_cast<std::size_t>(next);
    }
    const auto ratioLimit = std::min<std::uint64_t>(MaximumExtractedBytes,
        std::max<std::uint64_t>(512ULL * 1024ULL * 1024ULL,
            compressedBytes > MaximumExtractedBytes / 25 ? MaximumExtractedBytes : compressedBytes * 25));
    if (extractedBytes == 0 || extractedBytes > ratioLimit) {
        throw std::runtime_error("Update archive expansion ratio is unsafe.");
    }
    return extractedBytes;
}

void EnsureFreeSpace(const fs::path& root, std::uint64_t requiredBytes)
{
    const auto available = fs::space(root).available;
    if (requiredBytes > std::numeric_limits<std::uint64_t>::max() - MinimumFreeSpaceReserve ||
        available < requiredBytes + MinimumFreeSpaceReserve) {
        throw std::runtime_error("Insufficient disk space for update.");
    }
}

void RenameWithRetry(const fs::path& source, const fs::path& destination)
{
    std::error_code last;
    for (int attempt = 0; attempt < 6; ++attempt) {
        last.clear();
        fs::rename(source, destination, last);
        if (!last) return;
        std::this_thread::sleep_for(std::chrono::milliseconds(250 * (attempt + 1)));
    }
    throw fs::filesystem_error("Unable to commit extracted update", source, destination, last);
}

void ExtractArchive(
    const fs::path& archive,
    const fs::path& destination,
    std::uint64_t expectedExtractedBytes)
{
    fs::remove_all(destination);
    fs::create_directories(destination);
    std::wstring command = L"powershell.exe -NoLogo -NoProfile -NonInteractive "
        L"-ExecutionPolicy Bypass -Command \"$ErrorActionPreference='Stop'; "
        L"Expand-Archive -LiteralPath " + QuotePowerShellLiteral(archive) +
        L" -DestinationPath " + QuotePowerShellLiteral(destination) + L" -Force\"";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESHOWWINDOW;
    startup.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(nullptr, command.data(), nullptr, nullptr, FALSE,
            CREATE_NO_WINDOW, nullptr, destination.parent_path().c_str(), &startup, &process)) {
        throw std::runtime_error("Unable to start archive extraction.");
    }
    CloseHandle(process.hThread);
    const DWORD wait = WaitForSingleObject(process.hProcess, 5 * 60 * 1000);
    DWORD exitCode = 1;
    GetExitCodeProcess(process.hProcess, &exitCode);
    if (wait != WAIT_OBJECT_0) {
        TerminateProcess(process.hProcess, 0x4C494C41);
        WaitForSingleObject(process.hProcess, 5000);
    }
    CloseHandle(process.hProcess);
    if (wait != WAIT_OBJECT_0 || exitCode != 0) {
        fs::remove_all(destination);
        throw std::runtime_error("Update archive extraction failed.");
    }
    if (!fs::is_regular_file(destination / AppExecutable) ||
        !fs::is_regular_file(destination / LauncherExecutable)) {
        fs::remove_all(destination);
        throw std::runtime_error("Update does not contain all required executables.");
    }
    if (!AllowUnsignedUpdates() &&
        (!VerifyAuthenticode(destination / AppExecutable) ||
            !VerifyAuthenticode(destination / LauncherExecutable))) {
        fs::remove_all(destination);
        throw std::runtime_error("Update executables failed Authenticode verification.");
    }
    std::uint64_t actualExtractedBytes = 0;
    for (const auto& entry : fs::recursive_directory_iterator(destination)) {
        if (entry.is_symlink() || (entry.status().permissions() == fs::perms::unknown)) {
            fs::remove_all(destination);
            throw std::runtime_error("Update contains an unsafe filesystem entry.");
        }
        if (entry.is_regular_file()) {
            const auto size = entry.file_size();
            if (actualExtractedBytes > expectedExtractedBytes ||
                size > expectedExtractedBytes - actualExtractedBytes) {
                fs::remove_all(destination);
                throw std::runtime_error("Extracted update exceeds its declared size.");
            }
            actualExtractedBytes += size;
        }
    }
    if (actualExtractedBytes != expectedExtractedBytes) {
        fs::remove_all(destination);
        throw std::runtime_error("Extracted update size does not match ZIP metadata.");
    }
}

fs::path PrepareRelease(const fs::path& root, const Manifest& manifest)
{
    const fs::path finalPath = ReleasePath(root, manifest.releaseId);
    if (fs::is_regular_file(finalPath / AppExecutable) &&
        fs::is_regular_file(finalPath / LauncherExecutable)) return finalPath;
    const fs::path stagingRoot = root / L"staging";
    fs::create_directories(stagingRoot);
    const fs::path archive = stagingRoot / (Widen(manifest.releaseId) + L".download");
    EnsureFreeSpace(root, manifest.size * 2);
    DownloadFile(manifest.url, archive, manifest.size);
    if (fs::file_size(archive) != manifest.size || Sha256(archive) != manifest.sha256) {
        fs::remove(archive);
        throw std::runtime_error("Downloaded update failed integrity verification.");
    }
    const auto extractedBytes = InspectArchive(archive, manifest.size);
    EnsureFreeSpace(root, extractedBytes + manifest.size);
    const fs::path extracted = stagingRoot / (Widen(manifest.releaseId) + L".extracting");
    ExtractArchive(archive, extracted, extractedBytes);
    fs::create_directories(finalPath.parent_path());
    if (fs::exists(finalPath)) fs::remove_all(finalPath);
    RenameWithRetry(extracted, finalPath);
    fs::remove(archive);
    return finalPath;
}

struct Process
{
    HANDLE handle = nullptr;
    DWORD id = 0;
    ~Process() { if (handle) CloseHandle(handle); }
    Process() = default;
    Process(const Process&) = delete;
    Process& operator=(const Process&) = delete;
    Process(Process&& other) noexcept : handle(other.handle), id(other.id) {
        other.handle = nullptr; other.id = 0;
    }
    Process& operator=(Process&& other) noexcept {
        if (this != &other) { if (handle) CloseHandle(handle); handle = other.handle; id = other.id; other.handle = nullptr; }
        return *this;
    }
};

Process LaunchClient(const fs::path& directory)
{
    const fs::path executable = directory / AppExecutable;
    std::wstring command = L"\"" + executable.wstring() + L"\"";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION information{};
    if (!CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr,
            FALSE, 0, nullptr, directory.c_str(), &startup, &information)) {
        throw std::runtime_error("Unable to launch client.");
    }
    CloseHandle(information.hThread);
    Process result;
    result.handle = information.hProcess;
    result.id = information.dwProcessId;
    return result;
}

bool WaitForHealthy(const Process& process)
{
    const std::wstring name = L"Local\\LeMondeDeLilaWX.Healthy." + std::to_wstring(process.id);
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(30);
    while (std::chrono::steady_clock::now() < deadline) {
        if (WaitForSingleObject(process.handle, 0) == WAIT_OBJECT_0) return false;
        HANDLE signal = OpenEventW(SYNCHRONIZE, FALSE, name.c_str());
        if (signal) {
            const bool healthy = WaitForSingleObject(signal, 0) == WAIT_OBJECT_0;
            CloseHandle(signal);
            if (healthy) return true;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    return false;
}

BOOL CALLBACK CloseClientWindow(HWND window, LPARAM processId)
{
    DWORD owner = 0;
    GetWindowThreadProcessId(window, &owner);
    if (owner == static_cast<DWORD>(processId)) PostMessageW(window, WM_CLOSE, 0, 0);
    return TRUE;
}

void StopForUpdate(Process& process)
{
    const std::wstring name = L"Local\\LeMondeDeLilaWX.Update." + std::to_wstring(process.id);
    HANDLE signal = CreateEventW(nullptr, TRUE, TRUE, name.c_str());
    EnumWindows(CloseClientWindow, static_cast<LPARAM>(process.id));
    if (WaitForSingleObject(process.handle, 30 * 1000) != WAIT_OBJECT_0) {
        TerminateProcess(process.handle, 0x4C494C41);
        WaitForSingleObject(process.handle, 5000);
    }
    if (signal) CloseHandle(signal);
}

enum class LauncherReplacement { NotNeeded, Spawned, Failed };

LauncherReplacement SpawnLauncherReplacement(
    const fs::path& candidate,
    const fs::path& target)
{
    if (!fs::is_regular_file(candidate)) return LauncherReplacement::Failed;
    try {
        if (Sha256(candidate) == Sha256(target)) return LauncherReplacement::NotNeeded;
    } catch (...) {
        return LauncherReplacement::Failed;
    }
    std::wstring command = L"\"" + candidate.wstring() + L"\" --replace-launcher " +
        std::to_wstring(GetCurrentProcessId()) + L" \"" + target.wstring() + L"\"";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(candidate.c_str(), command.data(), nullptr, nullptr,
            FALSE, CREATE_NO_WINDOW, nullptr, candidate.parent_path().c_str(),
            &startup, &process)) return LauncherReplacement::Failed;
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return LauncherReplacement::Spawned;
}

int ReplaceLauncher(DWORD parentProcessId, const fs::path& target)
{
    const fs::path source = fs::weakly_canonical(ExecutablePath());
    const fs::path versions = source.parent_path().parent_path();
    const fs::path root = versions.parent_path();
    if (source.filename() != L"lila_launcher.exe" ||
        versions.filename() != L"versions" ||
        fs::weakly_canonical(target) != fs::weakly_canonical(root / L"lila_launcher.exe")) {
        return 4;
    }
    HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, parentProcessId);
    if (parent) {
        WaitForSingleObject(parent, 30 * 1000);
        CloseHandle(parent);
    }
    const fs::path temporary = target.wstring() + L".new";
    fs::copy_file(source, temporary, fs::copy_options::overwrite_existing);
    bool replaced = false;
    for (int attempt = 0; attempt < 8; ++attempt) {
        if (MoveFileExW(temporary.c_str(), target.c_str(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            replaced = true;
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(250 * (attempt + 1)));
    }
    int resultCode = 0;
    if (!replaced) {
        fs::remove(temporary);
        resultCode = 2;
    }
    std::wstring command = L"\"" + target.wstring() + L"\"";
    if (!replaced) command += L" --skip-launcher-replace-once";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(target.c_str(), command.data(), nullptr, nullptr,
            FALSE, 0, nullptr, target.parent_path().c_str(), &startup, &process)) return 3;
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return resultCode;
}

void AdoptBundledVersion(const fs::path& root, State& state)
{
    if (!state.currentReleaseId.empty()) return;
    const fs::path bundled = root / L"app";
    if (!fs::is_regular_file(bundled / AppExecutable) ||
        !fs::is_regular_file(bundled / LauncherExecutable)) return;
    state.currentVersion = lila::modules::update::UpdateBuildConfig::BuildVersion;
    state.currentReleaseId = "bundled";
    const auto destination = ReleasePath(root, state.currentReleaseId);
    fs::create_directories(destination.parent_path());
    const bool destinationIsValid =
        fs::is_regular_file(destination / AppExecutable) &&
        fs::is_regular_file(destination / LauncherExecutable);
    if (destinationIsValid) {
        fs::remove_all(bundled);
    } else {
        if (fs::exists(destination)) fs::remove_all(destination);
        fs::rename(bundled, destination);
    }
    SaveState(root, state);
}

void CleanupStaging(const fs::path& root) noexcept
{
    try {
        fs::remove_all(root / L"staging");
    } catch (...) {
    }
}

void CleanupOldVersions(const fs::path& root, const State& state) noexcept
{
    try {
        const fs::path versions = root / L"versions";
        if (!fs::is_directory(versions)) return;
        for (const auto& entry : fs::directory_iterator(versions)) {
            if (!entry.is_directory()) continue;
            const auto id = Narrow(entry.path().filename().wstring());
            if (id == state.currentReleaseId || id == state.retainedReleaseId) continue;
            if (IsSafeReleaseId(id) && entry.path().parent_path() == versions) {
                fs::remove_all(entry.path());
            }
        }
    } catch (...) {
    }
}

bool RestartForLauncherUpdate(const fs::path& root, const State& state)
{
    if (state.currentReleaseId.empty()) return false;
    const auto candidate = ReleasePath(root, state.currentReleaseId) / LauncherExecutable;
    const auto replacement = SpawnLauncherReplacement(candidate, ExecutablePath());
    if (replacement == LauncherReplacement::Spawned) return true;
    if (replacement == LauncherReplacement::Failed) {
        AppendLog(root, "WARN", "Launcher replacement could not be started; it will be retried.");
    }
    return false;
}

void RecordSignedPolicy(const fs::path& root, State& state, const Manifest& manifest)
{
    if (manifest.sequence < state.highestSequence) {
        throw std::runtime_error("Update manifest sequence attempted a downgrade.");
    }
    bool changed = false;
    if (manifest.sequence > state.highestSequence) {
        state.highestSequence = manifest.sequence;
        changed = true;
    }
    const auto required = RequiredVersion(manifest);
    if (!required.empty() &&
        (state.requiredVersion.empty() || IsUpdateNewer(required, state.requiredVersion))) {
        state.requiredVersion = required;
        changed = true;
    }
    if (changed) SaveState(root, state);
}

bool LocalVersionIsAllowed(const State& state)
{
    if (state.requiredVersion.empty() ||
        !IsUpdateNewer(state.requiredVersion, state.currentVersion)) return true;
    return !state.failedVersion.empty() &&
        !IsUpdateNewer(state.requiredVersion, state.failedVersion);
}

void ActivateRelease(const fs::path& root, State& state, const Manifest& manifest)
{
    state.previousVersion = state.currentVersion;
    state.previousReleaseId = state.currentReleaseId;
    state.currentVersion = manifest.version;
    state.currentReleaseId = manifest.releaseId;
    SaveState(root, state);
}

int RunLauncher(bool skipLauncherReplacement)
{
    HANDLE mutex = CreateMutexW(nullptr, TRUE, LauncherMutex);
    if (!mutex || GetLastError() == ERROR_ALREADY_EXISTS) {
        if (mutex) CloseHandle(mutex);
        return 0;
    }
    const fs::path root = ExecutablePath().parent_path();
    State state = ReadState(root);
    AdoptBundledVersion(root, state);
    CleanupStaging(root);
    CleanupOldVersions(root, state);
    if (!skipLauncherReplacement && RestartForLauncherUpdate(root, state)) return 0;

    std::optional<Manifest> pending;
    try {
        auto manifest = ParseManifest(DownloadText(ManifestUrl(state.currentVersion)));
        RecordSignedPolicy(root, state, manifest);
        if (manifest.releaseId != state.failedReleaseId &&
            IsUpdateNewer(manifest.version, state.currentVersion)) {
            PrepareRelease(root, manifest);
            pending = std::move(manifest);
        }
    } catch (const std::exception& error) {
        AppendLog(root, "WARN", std::string("Startup update check failed: ") + error.what());
    }
    if (pending) {
        ActivateRelease(root, state, *pending);
        AppendLog(root, "INFO", "Activated update " + pending->version + ".");
        if (RestartForLauncherUpdate(root, state)) return 0;
    }
    if (state.currentReleaseId.empty()) throw std::runtime_error("No installed client version.");
    if (!LocalVersionIsAllowed(state)) {
        throw std::runtime_error(
            "A mandatory update is required and could not be installed. Check update.log and retry with network access.");
    }

    while (true) {
        Process process = LaunchClient(ReleasePath(root, state.currentReleaseId));
        if (!WaitForHealthy(process)) {
            if (state.previousReleaseId.empty()) throw std::runtime_error("Client failed its startup health check.");
            TerminateProcess(process.handle, 0x4C494C41);
            WaitForSingleObject(process.handle, 5000);
            state.failedReleaseId = state.currentReleaseId;
            state.failedVersion = state.currentVersion;
            state.currentReleaseId = state.previousReleaseId;
            state.currentVersion = state.previousVersion;
            state.previousReleaseId.clear();
            state.previousVersion.clear();
            SaveState(root, state);
            CleanupOldVersions(root, state);
            AppendLog(root, "ERROR", "Rolled back failed release " + state.failedReleaseId + ".");
            continue;
        }
        if (!state.previousReleaseId.empty()) {
            state.retainedReleaseId = state.previousReleaseId;
            state.previousReleaseId.clear();
            state.previousVersion.clear();
            SaveState(root, state);
            CleanupOldVersions(root, state);
        }
        AppendLog(root, "INFO", "Client health check succeeded for " + state.currentVersion + ".");

        bool restartingForUpdate = false;
        while (WaitForSingleObject(process.handle, static_cast<DWORD>(PollInterval.count() * 1000)) == WAIT_TIMEOUT) {
            try {
                auto manifest = ParseManifest(DownloadText(ManifestUrl(state.currentVersion)));
                RecordSignedPolicy(root, state, manifest);
                if (manifest.releaseId == state.failedReleaseId ||
                    !IsUpdateNewer(manifest.version, state.currentVersion)) continue;
                PrepareRelease(root, manifest);
                StopForUpdate(process);
                ActivateRelease(root, state, manifest);
                restartingForUpdate = true;
                AppendLog(root, "INFO", "Activated live update " + manifest.version + ".");
                if (RestartForLauncherUpdate(root, state)) return 0;
                break;
            } catch (const std::exception& error) {
                AppendLog(root, "WARN", std::string("Live update check failed: ") + error.what());
            }
        }
        if (!restartingForUpdate && WaitForSingleObject(process.handle, 0) == WAIT_OBJECT_0) return 0;
    }
}
}

int lila::modules::update::RunUpdateLauncher()
{
    try {
        int argumentCount = 0;
        LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &argumentCount);
        if (arguments && argumentCount == 4 && std::wstring(arguments[1]) == L"--replace-launcher") {
            const DWORD parentId = static_cast<DWORD>(std::stoul(arguments[2]));
            const fs::path target(arguments[3]);
            LocalFree(arguments);
            return ReplaceLauncher(parentId, target);
        }
        const bool skipLauncherReplacement = arguments && argumentCount == 2 &&
            std::wstring(arguments[1]) == L"--skip-launcher-replace-once";
        if (arguments) LocalFree(arguments);
        return RunLauncher(skipLauncherReplacement);
    } catch (const std::exception& error) {
        MessageBoxW(nullptr, Widen(error.what()).c_str(), L"Le Monde de Lila - Mise à jour",
            MB_OK | MB_ICONERROR | MB_SETFOREGROUND);
        return 1;
    }
}

#endif
