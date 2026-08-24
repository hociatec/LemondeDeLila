#pragma once

#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>

namespace lila::shared::persistence
{
inline void WriteTextAtomically(
    const std::filesystem::path& path,
    const std::string& content,
    const char* errorMessage)
{
    const std::filesystem::path temporaryPath = path.string() + ".tmp";

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
}
}
