#pragma once
#ifdef _WIN32
#include <array>
#include <algorithm>
#include <stdexcept>
#include <string>
#include <windows.h>
#include <winhttp.h>
#include "shared/errors/catalog/NetworkErrorMessages.h"

namespace lila::shared::network::http::detail
{
inline std::string ReadResponseBody(HINTERNET request, std::size_t maximumBytes)
{
    std::string body;
    std::array<char, 4096> buffer{};
    while (true)
    {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request, &available))
            throw std::runtime_error(lila::shared::errors::HttpResponseReadFailed);
        if (available == 0) break;
        if (body.size() + available > maximumBytes)
            throw std::runtime_error("Réponse HTTP trop volumineuse.");
        DWORD read = 0;
        if (!WinHttpReadData(request, buffer.data(),
            std::min<DWORD>(available, static_cast<DWORD>(buffer.size())), &read))
            throw std::runtime_error(lila::shared::errors::HttpResponseReadFailed);
        if (read == 0) break;
        body.append(buffer.data(), buffer.data() + read);
    }
    return body;
}
}
#endif
