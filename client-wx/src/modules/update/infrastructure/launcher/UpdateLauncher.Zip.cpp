#include <cstdio>
#include <stdexcept>
#include <string>
#include <vector>

#define MINIZ_NO_ZLIB_APIS
#include <miniz.h>

#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
namespace
{
class ZipReader final
{
public:
    explicit ZipReader(const fs::path& archive)
    {
        if (_wfopen_s(&file_, archive.c_str(), L"rb") != 0 || !file_) {
            throw std::runtime_error("Unable to open update archive.");
        }
        mz_zip_zero_struct(&archive_);
        if (!mz_zip_reader_init_cfile(&archive_, file_, 0, 0)) {
            std::fclose(file_);
            file_ = nullptr;
            throw std::runtime_error("Unable to initialize ZIP extraction.");
        }
        initialized_ = true;
    }

    ~ZipReader()
    {
        if (initialized_) mz_zip_reader_end(&archive_);
        if (file_) std::fclose(file_);
    }

    ZipReader(const ZipReader&) = delete;
    ZipReader& operator=(const ZipReader&) = delete;

    mz_zip_archive& Archive() noexcept { return archive_; }

private:
    std::FILE* file_ = nullptr;
    mz_zip_archive archive_{};
    bool initialized_ = false;
};

fs::path EntryPath(const fs::path& destination, const std::string& name)
{
    if (!IsSafeArchivePath(name)) {
        throw std::runtime_error("Unsafe ZIP filesystem entry.");
    }
    return destination / fs::u8path(name.begin(), name.end());
}

void ExtractFile(mz_zip_archive& archive, mz_uint index, const fs::path& target)
{
    fs::create_directories(target.parent_path());
    std::FILE* output = nullptr;
    if (_wfopen_s(&output, target.c_str(), L"wb") != 0 || !output) {
        throw std::runtime_error("Unable to create extracted update file.");
    }
    const bool extracted =
        mz_zip_reader_extract_to_cfile(&archive, index, output, 0) == MZ_TRUE;
    const bool closed = std::fclose(output) == 0;
    if (!extracted || !closed) {
        throw std::runtime_error("Native ZIP extraction failed.");
    }
}

void ExtractEntries(const fs::path& archivePath, const fs::path& destination)
{
    ZipReader reader(archivePath);
    auto& archive = reader.Archive();
    const mz_uint count = mz_zip_reader_get_num_files(&archive);
    if (count == 0 || count > MaximumArchiveEntries) {
        throw std::runtime_error("ZIP entry count is invalid.");
    }
    for (mz_uint index = 0; index < count; ++index) {
        mz_zip_archive_file_stat info{};
        if (!mz_zip_reader_file_stat(&archive, index, &info) ||
            (info.m_bit_flag & 1U) != 0 ||
            ((info.m_external_attr >> 16) & 0170000U) == 0120000U) {
            throw std::runtime_error("Unable to read ZIP entry metadata.");
        }
        const mz_uint nameSize = mz_zip_reader_get_filename(&archive, index, nullptr, 0);
        if (nameSize <= 1) {
            throw std::runtime_error("ZIP entry has no filename.");
        }
        std::vector<char> nameBuffer(nameSize);
        if (mz_zip_reader_get_filename(
                &archive, index, nameBuffer.data(), nameSize) != nameSize) {
            throw std::runtime_error("Unable to read ZIP entry filename.");
        }
        const std::string name(nameBuffer.data(), nameSize - 1);
        const auto target = EntryPath(destination, name);
        if (mz_zip_reader_is_file_a_directory(&archive, index)) {
            fs::create_directories(target);
        } else {
            ExtractFile(archive, index, target);
        }
    }
}

void VerifyExtractedPayload(
    const fs::path& destination,
    std::uint64_t expectedExtractedBytes,
    UpdateProgressDialog* progress)
{
    if (progress) progress->SetStage(L"Vérification des exécutables…", 94);
    if (!fs::is_regular_file(destination / AppExecutable) ||
        !fs::is_regular_file(destination / LauncherExecutable)) {
        throw std::runtime_error("Update does not contain all required executables.");
    }
    if (!AllowUnsignedUpdates()) {
        for (const auto* executable : {AppExecutable, LauncherExecutable}) {
            std::string failure;
            if (!VerifyAuthenticodeWithRetry(destination / executable, &failure)) {
                throw std::runtime_error(
                    "Update executable " + Narrow(executable) +
                    " failed Authenticode verification (" + failure + ").");
            }
        }
    }
    if (progress) progress->SetStage(L"Contrôle de l'installation…", 97);
    std::uint64_t actualExtractedBytes = 0;
    for (const auto& entry : fs::recursive_directory_iterator(destination)) {
        if (entry.is_symlink() || entry.status().permissions() == fs::perms::unknown) {
            throw std::runtime_error("Update contains an unsafe filesystem entry.");
        }
        if (!entry.is_regular_file()) continue;
        const auto size = entry.file_size();
        if (actualExtractedBytes > expectedExtractedBytes ||
            size > expectedExtractedBytes - actualExtractedBytes) {
            throw std::runtime_error("Extracted update exceeds its declared size.");
        }
        actualExtractedBytes += size;
    }
    if (actualExtractedBytes != expectedExtractedBytes) {
        throw std::runtime_error("Extracted update size does not match ZIP metadata.");
    }
}
}

void ExtractArchive(
    const fs::path& archive,
    const fs::path& destination,
    std::uint64_t expectedExtractedBytes,
    UpdateProgressDialog* progress)
{
    if (progress) progress->SetStage(L"Installation des fichiers…", 88);
    fs::remove_all(destination);
    fs::create_directories(destination);
    try {
        ExtractEntries(archive, destination);
        VerifyExtractedPayload(destination, expectedExtractedBytes, progress);
    } catch (...) {
        std::error_code ignored;
        fs::remove_all(destination, ignored);
        throw;
    }
}
}
