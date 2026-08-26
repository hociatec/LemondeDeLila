#pragma once

#include <filesystem>

#include <nlohmann/json.hpp>

namespace lila::shared::persistence
{
class JsonFileStorage final
{
public:
    [[nodiscard]] static std::filesystem::path ResolvePath(const char* fileName);
    [[nodiscard]] static bool ReadIfExists(const std::filesystem::path& path, nlohmann::json& content);
    static void Write(const std::filesystem::path& path, const nlohmann::json& content, const char* errorMessage);

private:
    JsonFileStorage() = default;
};
}
