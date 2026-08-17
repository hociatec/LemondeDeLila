#pragma once

#include <stdexcept>
#include <string>

#include <wx/ffile.h>
#include <wx/filefn.h>

namespace lila::shared::persistence {

inline void WriteTextAtomically(
    const wxString& path,
    const std::string& content,
    const char* errorMessage)
{
    const wxString temporaryPath = path + ".tmp";
    wxFFile temporaryFile(temporaryPath, "wb");
    if (!temporaryFile.IsOpened() || !temporaryFile.Write(content))
    {
        if (temporaryFile.IsOpened())
        {
            temporaryFile.Close();
        }
        wxRemoveFile(temporaryPath);
        throw std::runtime_error(errorMessage);
    }

    temporaryFile.Close();
    if (!wxRenameFile(temporaryPath, path, true))
    {
        wxRemoveFile(temporaryPath);
        throw std::runtime_error(errorMessage);
    }
}

}
