#include "shared/persistence/infrastructure/JsonFileStorage.h"

#include "shared/config/infrastructure/AppDataPaths.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "shared/errors/presentation/ErrorFormatting.h"
#include "shared/persistence/infrastructure/AtomicFileWriter.h"

#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>

namespace
{
constexpr std::uintmax_t MaxJsonFileSizeBytes = 1024 * 1024;
}

namespace lila::shared::persistence
{
std::filesystem::path JsonFileStorage::ResolvePath(const char* fileName)
{
    return lila::shared::config::AppDataPaths::ResolveUserLocalFile(fileName);
}

bool JsonFileStorage::ReadIfExists(const std::filesystem::path& path, nlohmann::json& content)
{
    if (!std::filesystem::exists(path))
    {
        return false;
    }

    const auto length = std::filesystem::file_size(path);
    if (length > MaxJsonFileSizeBytes)
    {
        throw std::runtime_error(lila::shared::errors::JsonFileTooLarge);
    }

    std::ifstream file(path, std::ios::binary);
    if (!file.is_open())
    {
        throw std::runtime_error(lila::shared::errors::JsonFileOpenFailed);
    }

    std::string raw(static_cast<std::size_t>(length), '\0');
    if (!raw.empty())
    {
        file.read(raw.data(), static_cast<std::streamsize>(raw.size()));
        if (!file.good() && !file.eof())
        {
            throw std::runtime_error(lila::shared::errors::JsonFileReadFailed);
        }
    }

    try
    {
        content = nlohmann::json::parse(raw);
    }
    catch (const nlohmann::json::exception& error)
    {
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::CorruptedJsonFile, error.what()));
    }

    return true;
}

void JsonFileStorage::Write(const std::filesystem::path& path, const nlohmann::json& content, const char* errorMessage)
{
    WriteTextAtomically(path, content.dump(2), errorMessage);
}
}
