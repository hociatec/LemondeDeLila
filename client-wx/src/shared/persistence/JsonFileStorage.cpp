#include "shared/persistence/JsonFileStorage.h"
#include "shared/persistence/AtomicFileWriter.h"
#include "shared/errors/ErrorMessages.h"

#include <stdexcept>

#include <wx/filefn.h>
#include <wx/filename.h>
#include <wx/stdpaths.h>

#include <nlohmann/json.hpp>

namespace
{
wxString ResolveDataPath(const char* fileName)
{
    wxFileName fileNameWithPath(wxStandardPaths::Get().GetUserLocalDataDir(), fileName);
    if (!fileNameWithPath.DirExists())
    {
        fileNameWithPath.Mkdir(wxS_DIR_DEFAULT, wxPATH_MKDIR_FULL);
    }

    return fileNameWithPath.GetFullPath();
}
}

namespace lila::shared::persistence
{
wxString JsonFileStorage::ResolvePath(const char* fileName)
{
    return ResolveDataPath(fileName);
}

bool JsonFileStorage::ReadIfExists(const wxString& path, nlohmann::json& content)
{
    if (!wxFileExists(path))
    {
        return false;
    }

    wxFFile file(path, "rb");
    if (!file.IsOpened())
    {
        throw std::runtime_error(lila::shared::errors::JsonFileOpenFailed);
    }

    wxString raw;
    if (!file.ReadAll(&raw))
    {
        throw std::runtime_error(lila::shared::errors::JsonFileReadFailed);
    }

    try
    {
        content = nlohmann::json::parse(raw.ToStdString());
    }
    catch (const nlohmann::json::exception& error)
    {
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::CorruptedJsonFile, error.what()));
    }

    return true;
}

nlohmann::json JsonFileStorage::ReadRequired(const wxString& path, const char* parseErrorMessage)
{
    nlohmann::json content;
    if (!ReadIfExists(path, content))
    {
        throw std::runtime_error(parseErrorMessage);
    }

    return content;
}

void JsonFileStorage::Write(const wxString& path, const nlohmann::json& content, const char* errorMessage)
{
    WriteTextAtomically(path, content.dump(2), errorMessage);
}

void JsonFileStorage::Remove(const wxString& path, const char* errorMessage)
{
    if (!wxFileExists(path))
    {
        return;
    }

    if (!wxRemoveFile(path))
    {
        throw std::runtime_error(errorMessage);
    }
}
}

