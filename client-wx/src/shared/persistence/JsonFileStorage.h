#pragma once

#include <nlohmann/json.hpp>

#include <string>

#include <wx/string.h>
#include <wx/ffile.h>

namespace lila::shared::persistence
{
class JsonFileStorage final
{
public:
    [[nodiscard]] static wxString ResolvePath(const char* fileName);
    [[nodiscard]] static bool ReadIfExists(const wxString& path, nlohmann::json& content);
    [[nodiscard]] static nlohmann::json ReadRequired(const wxString& path, const char* parseErrorMessage);
    static void Write(const wxString& path, const nlohmann::json& content, const char* errorMessage);
    static void Remove(const wxString& path, const char* errorMessage);

private:
    JsonFileStorage() = default;
};
}
