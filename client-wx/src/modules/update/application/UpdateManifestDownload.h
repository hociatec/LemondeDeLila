#pragma once

#include <chrono>
#include <exception>
#include <stdexcept>
#include <string>

namespace lila::modules::update
{
template <typename Download, typename Wait>
std::string DownloadUpdateManifestWithRetry(Download download, Wait wait)
{
    std::string lastFailure;
    for (int attempt = 1; attempt <= 3; ++attempt)
    {
        try
        {
            auto result = download();
            if (result.find_first_not_of(" \t\r\n") == std::string::npos)
                throw std::runtime_error("Update server returned an empty manifest.");
            return result;
        }
        catch (const std::exception& error)
        {
            lastFailure = error.what();
            if (attempt < 3) wait(std::chrono::milliseconds(500 * attempt));
        }
    }
    throw std::runtime_error(
        "Update manifest download failed after 3 attempts. Last error: " + lastFailure);
}
}
