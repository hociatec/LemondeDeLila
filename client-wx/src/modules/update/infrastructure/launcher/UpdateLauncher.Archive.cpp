#include <algorithm>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <thread>
#include <vector>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
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
    const fs::path archive = stagingRoot / Widen(BuildStagedUpdateArchiveFileName(manifest.releaseId));
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
}

