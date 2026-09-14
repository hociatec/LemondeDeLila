#pragma once

#include <map>
#include <stop_token>
#include <string>
#include <string_view>

namespace lila::shared::network::http
{
struct HttpRequest final
{
    std::string method = "GET";
    std::string url;
    std::string body;
    std::string contentType;
    std::map<std::string, std::string> headers;
};

struct HttpResponse final
{
    unsigned long statusCode = 0;
    std::string body;

    [[nodiscard]] bool IsSuccess() const noexcept
    {
        return statusCode >= 200 && statusCode < 300;
    }
};

class AuthenticatedHttpClient final
{
public:
    [[nodiscard]] HttpResponse Send(
        const HttpRequest& request,
        const std::string& bearerToken,
        std::stop_token stopToken = {}) const;
};

[[nodiscard]] std::string UrlEncode(std::string_view value);
}
