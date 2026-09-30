#include <algorithm>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <vector>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
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
    if (entryCount == 0xffff || !IsArchiveDirectoryLayoutSafe(
            compressedBytes, directoryOffset, directorySize, entryCount)) {
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
        if (unpacked > MaximumExtractedEntryBytes) {
            throw std::runtime_error("ZIP entry exceeds its safety limit.");
        }
        if (extractedBytes > MaximumExtractedBytes - unpacked) {
            throw std::runtime_error("Uncompressed update exceeds its safety limit.");
        }
        extractedBytes += unpacked;
        offset = static_cast<std::size_t>(next);
    }
    if (!IsArchiveExpansionSafe(compressedBytes, extractedBytes, entryCount)) {
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

void RenameWithRetry(
    const fs::path& source,
    const fs::path& destination,
    const UpdateProgressDialog* progress)
{
    std::error_code last;
    for (int attempt = 0; attempt < 6; ++attempt) {
        last.clear();
        fs::rename(source, destination, last);
        if (!last) return;
        if (!WaitForRetry(std::chrono::milliseconds(250 * (attempt + 1)), progress))
            throw std::runtime_error("Update cancelled by user.");
    }
    throw fs::filesystem_error("Unable to commit extracted update", source, destination, last);
}

}
