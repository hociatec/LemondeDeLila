#pragma once

#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>

#ifdef _WIN32
#include <windows.h>
#endif

namespace lila::shared::persistence
{
inline void WriteTextAtomically(
    const std::filesystem::path& path,
    const std::string& content,
    const char* errorMessage)
{
    // Keep the native path representation: converting through std::string
    // breaks writes for some Windows profile names containing non-ASCII text.
    std::filesystem::path temporaryPath = path;
#ifdef _WIN32
    temporaryPath += L".tmp";
#else
    temporaryPath += ".tmp";
#endif

    std::ofstream temporaryFile(temporaryPath, std::ios::binary | std::ios::trunc);
    if (!temporaryFile.is_open())
    {
        std::error_code removeError;
        std::filesystem::remove(temporaryPath, removeError);
        throw std::runtime_error(errorMessage);
    }

    temporaryFile.write(content.data(), static_cast<std::streamsize>(content.size()));
    if (!temporaryFile.good())
    {
        temporaryFile.close();
        std::error_code removeError;
        std::filesystem::remove(temporaryPath, removeError);
        throw std::runtime_error(errorMessage);
    }

    temporaryFile.close();

#ifdef _WIN32
    // MoveFileEx performs a replace atomically without deleting the existing
    // file first. This is more reliable with antivirus/file-indexing tools and
    // never leaves a valid options or session file deliberately removed.
    if (MoveFileExW(
            temporaryPath.c_str(),
            path.c_str(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH))
    {
        return;
    }
    std::error_code removeTempError;
    std::filesystem::remove(temporaryPath, removeTempError);
    throw std::runtime_error(errorMessage);
#else
    std::error_code renameError;
    std::filesystem::rename(temporaryPath, path, renameError);
    if (!renameError)
    {
        return;
    }

    std::error_code removeExistingError;
    std::filesystem::remove(path, removeExistingError);
    renameError.clear();
    std::filesystem::rename(temporaryPath, path, renameError);
    if (renameError)
    {
        std::error_code removeTempError;
        std::filesystem::remove(temporaryPath, removeTempError);
        throw std::runtime_error(errorMessage);
    }
#endif
}
}
