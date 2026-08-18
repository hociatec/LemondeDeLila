#include "shared/persistence/JsonFileStorage.h"
#include "shared/persistence/AtomicFileWriter.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/Encoding.h"

#include <stdexcept>

#include <wx/filefn.h>
#include <wx/filename.h>
#include <wx/stdpaths.h>

#include <nlohmann/json.hpp>

namespace
{
wxString ResolveDataPath(const char* fileName)
{
    wxFileName fileNameWithPath(wxStandardPaths::Get().GetUserLocalDataDir(), lila::shared::text::FromUtf8(fileName));
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

    const wxFileOffset length = file.Length();
    if (length < 0)
    {
        throw std::runtime_error(lila::shared::errors::JsonFileReadFailed);
    }

    std::string raw(static_cast<std::size_t>(length), '\0');
    if (!raw.empty() && file.Read(raw.data(), raw.size()) != raw.size())
    {
        throw std::runtime_error(lila::shared::errors::JsonFileReadFailed);
    }

    // JSON files are UTF-8 bytes. Never round-trip them through wxString or the
    // process locale, otherwise accented characters can be corrupted.
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

