#include "modules/admin/infrastructure/AdminGateway.h"
#include "modules/session/application/SessionHttpRetry.h"

#include <filesystem>
#include <iomanip>
#include <random>
#include <sstream>
#include <stdexcept>

#include <nlohmann/json.hpp>

#include "modules/session/application/SessionStore.h"
#include "modules/admin/infrastructure/AdminPayloadValidator.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/errors/domain/AppError.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/network/domain/UrlUtils.h"

namespace lila::modules::admin::infrastructure
{
namespace
{
using lila::modules::admin::domain::AdminTransport;

std::pair<std::string, std::string> SplitOperation(const std::string& operation)
{
    const auto separator = operation.find(' ');
    if (separator == std::string::npos) throw std::runtime_error("Opération HTTP admin invalide.");
    return {operation.substr(0, separator), operation.substr(separator + 1)};
}

std::string ScalarText(const nlohmann::json& value)
{
    if (value.is_string()) return value.get<std::string>();
    if (value.is_number_integer()) return std::to_string(value.get<long long>());
    if (value.is_boolean()) return value.get<bool>() ? "true" : "false";
    throw std::runtime_error("Paramètre de chemin admin invalide.");
}

void ResolvePathFields(std::string& path, nlohmann::json& body)
{
    std::size_t start = 0;
    while ((start = path.find('{', start)) != std::string::npos)
    {
        const auto end = path.find('}', start + 1);
        if (end == std::string::npos) throw std::runtime_error("Chemin admin invalide.");
        const auto key = path.substr(start + 1, end - start - 1);
        const auto field = body.find(key);
        if (field == body.end()) throw std::runtime_error("Paramètre requis manquant : " + key);
        const auto encoded = lila::shared::network::http::UrlEncode(ScalarText(*field));
        path.replace(start, end - start + 1, encoded);
        body.erase(field);
        start += encoded.size();
    }
}

void AppendQuery(std::string& path, const nlohmann::json& values)
{
    bool first = true;
    for (const auto& item : values.items())
    {
        if (item.value().is_null() || item.value().is_array() || item.value().is_object()) continue;
        if (item.value().is_string() && item.value().get_ref<const std::string&>().empty()) continue;
        path += first ? '?' : '&';
        first = false;
        path += lila::shared::network::http::UrlEncode(item.key()) + "=" +
            lila::shared::network::http::UrlEncode(ScalarText(item.value()));
    }
}

std::string MultipartBoundary()
{
    std::ostringstream output;
    output << "----LilaAdminBoundary" << std::hex << std::setfill('0');
    std::random_device random;
    for (int index = 0; index < 4; ++index)
        output << std::setw(8) << random();
    return output.str();
}

void MakeMultipart(
    lila::shared::network::http::HttpRequest& request,
    const nlohmann::json& payload)
{
    const auto filePath = payload.value("filePath", std::string{});
    if (filePath.empty()) throw std::runtime_error("Chemin du fichier audio requis.");
    const auto utf8Filename = std::filesystem::path(
        std::u8string(filePath.begin(), filePath.end())).filename().u8string();
    std::string filename(utf8Filename.begin(), utf8Filename.end());
    for (auto& character : filename)
        if (character == '"' || character == '\r' || character == '\n') character = '_';
    const std::string boundary = MultipartBoundary();
    request.contentType = "multipart/form-data; boundary=" + boundary;
    request.uploadPrefix = "--" + boundary +
        "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" +
        filename + "\"\r\nContent-Type: application/octet-stream\r\n\r\n";
    request.uploadFilePath = filePath;
    request.uploadSuffix = "\r\n--" + boundary + "--\r\n";
    request.maximumUploadBytes = 250U * 1024U * 1024U;
}

nlohmann::json ParseHttpPayload(const lila::shared::network::http::HttpResponse& response)
{
    nlohmann::json parsed = nlohmann::json::object();
    if (!response.body.empty())
    {
        try { parsed = nlohmann::json::parse(response.body); }
        catch (const nlohmann::json::exception&)
        {
            throw std::runtime_error("Réponse HTTP admin invalide.");
        }
    }
    if (response.IsSuccess()) return parsed;
    std::string message = "Requête administrateur refusée (HTTP " + std::to_string(response.statusCode) + ").";
    if (parsed.is_object())
    {
        const auto found = parsed.find("message");
        if (found != parsed.end() && found->is_string()) message = found->get<std::string>();
        else if (found != parsed.end() && found->is_array() && !found->empty() &&
                 (*found)[0].is_string()) message = (*found)[0].get<std::string>();
    }
    throw lila::shared::errors::AppException(
        lila::shared::errors::ToAppError(message, "HTTP admin " + std::to_string(response.statusCode)));
}
}

AdminGateway::AdminGateway(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& apiClient,
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& notificationClient,
    lila::modules::session::application::SessionStore& sessionStore) noexcept
    : apiClient_(apiClient), notificationClient_(notificationClient), sessionStore_(sessionStore) {}

domain::AdminPayload AdminGateway::Execute(
    const domain::AdminCommand& command,
    const domain::AdminPayload& payload,
    const std::string& maintenanceToken,
    std::stop_token stopToken) const
{
    if (!sessionStore_.Current().IsAdmin())
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError("Accès administrateur requis."));
    nlohmann::json document;
    try
    {
        document = nlohmann::json::parse(payload.Serialized());
    }
    catch (const nlohmann::json::exception&)
    {
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(
                "Requête administrateur invalide.", "Invalid admin JSON payload."));
    }
    const auto result = command.transport == AdminTransport::ApiWebSocket ||
            command.transport == AdminTransport::NotificationWebSocket
        ? ExecuteRealtime(command, document, stopToken)
        : ExecuteHttp(command, document, maintenanceToken, stopToken);
    return domain::AdminPayload(result.dump());
}

nlohmann::json AdminGateway::ExecuteRealtime(
    const domain::AdminCommand& command,
    const nlohmann::json& payload,
    std::stop_token stopToken) const
{
    const auto& client = command.transport == AdminTransport::NotificationWebSocket
        ? notificationClient_ : apiClient_;
    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client, sessionStore_, "Aucune session administrateur active.", command.operation,
        payload, "Opération administrateur impossible.", stopToken,
        command.expectedResponseType);
    return ValidateAndNormalizeAdminPayload(response.payload);
}

nlohmann::json AdminGateway::ExecuteHttp(
    const domain::AdminCommand& command,
    const nlohmann::json& payload,
    const std::string& maintenanceToken,
    std::stop_token stopToken) const
{
    auto [method, path] = SplitOperation(command.operation);
    auto body = payload;
    ResolvePathFields(path, body);
    if (method == "GET") AppendQuery(path, body);
    lila::shared::network::http::HttpRequest request;
    request.method = method;
    request.url = lila::shared::network::WebSocketOriginToHttp(
        lila::shared::config::AppConfig::ResolveBackendApiWs()) + path;
    if (command.maintenanceToken && !maintenanceToken.empty())
        request.headers.emplace("x-admin-maintenance-token", maintenanceToken);
    if (command.transport == AdminTransport::HttpMultipart)
    {
        MakeMultipart(request, body);
        // Audio files are intentionally accepted up to 250 Mio. The default
        // 15-second HTTP send timeout is too short for a normal WAV upload.
        request.sendTimeoutMs = 180'000;
        request.receiveTimeoutMs = 180'000;
    }
    else if (method != "GET" && method != "DELETE")
    {
        request.contentType = "application/json";
        request.body = body.dump();
    }

    const auto response = lila::modules::session::application::SendHttpWithSessionRefresh(
        sessionStore_, stopToken, command.transport != AdminTransport::HttpMultipart,
        [this, &request, stopToken](const std::string& token)
        {
            return httpClient_.Send(request, token, stopToken);
        });
    return ValidateAndNormalizeAdminPayload(ParseHttpPayload(response));
}
}
