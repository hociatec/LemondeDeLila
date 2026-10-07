#include <filesystem>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <windows.h>
#include <nlohmann/json.hpp>
#include "modules/audio/infrastructure/SoundAssetPath.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/network/infrastructure/http/WsTicketTransport.h"

namespace
{
std::function<std::string(const std::string&, std::stop_token)> respond;
constexpr auto hashA = "559aead08264d5795d3909718cdd05abd49572e84fe55590eef31a88a08fdffd";
constexpr auto hashB = "df7e70e5021544f4834bbee64a9e3789febc4be81470df629cad6ddb03320a5c";
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}
std::string Manifest(const char* hash, const char* url, bool disabled = false)
{
    return nlohmann::json{{"sounds", {{"TableAmbience1", {
        {"url", url}, {"sha256", hash}, {"bytes", 1}}}}},
        {"disabled", disabled ? nlohmann::json::array({"TableAmbience1"}) : nlohmann::json::array()}}.dump();
}
}

namespace lila::shared::network::http
{
std::string RequestWsTicketResponse(const std::string& url, const std::string&,
    std::size_t, std::stop_token stopToken)
{
    return respond(url, stopToken);
}
}
std::string lila::shared::config::AppConfig::ResolveBackendApiWs()
{
    return "ws://127.0.0.1/ws/api";
}

int main()
{
    using lila::modules::audio::domain::SoundCue;
    using lila::modules::audio::infrastructure::SoundAssetPathResolver;
    const auto root = std::filesystem::temp_directory_path() /
        ("lila-audio-recovery-" + std::to_string(GetCurrentProcessId()));
    // This test process alone gets an isolated cache; existing user audio is never touched.
    SetEnvironmentVariableW(L"LOCALAPPDATA", root.c_str());
    try
    {
        std::filesystem::create_directories(root);
        int manifestRequests = 0;
        bool replace = false;
        bool disable = false;
        respond = [&](const std::string& url, std::stop_token token)
        {
            Expect(!token.stop_requested(), "A cancelled operation reached HTTP");
            if (url.ends_with("/manifest"))
            {
                ++manifestRequests;
                return replace ? Manifest(hashB, "/b", disable) : Manifest(hashA, "/a");
            }
            if (url.ends_with("/a")) { replace = true; throw std::runtime_error("404 replaced asset"); }
            Expect(url.ends_with("/b"), "Unexpected sound URL");
            return std::string("B");
        };
        SoundAssetPathResolver resolver;
        const auto current = resolver.Resolve(SoundCue::TableAmbience1);
        Expect(current.filename() == std::string(hashB) + ".wav" &&
            std::filesystem::file_size(current) == 1, "A stale 404 did not recover the replacement");
        Expect(manifestRequests == 2, "Manifest recovery must be bounded to one retry");
        disable = true;
        resolver.Invalidate();
        Expect(resolver.Resolve(SoundCue::TableAmbience1).empty(), "A disabled ambience stayed playable");
        Expect(resolver.ResolvePreview(SoundCue::TableAmbience1) == current,
            "Admin previews must still allow disabled sounds");
        std::stop_source cancelled;
        cancelled.request_stop();
        SoundAssetPathResolver stopped;
        stopped.SetStopToken(cancelled.get_token());
        const int before = manifestRequests;
        static_cast<void>(stopped.Resolve(SoundCue::TableAmbience1));
        Expect(before == manifestRequests, "Shutdown started another manifest request");
        std::filesystem::remove_all(root);
        std::cout << "Audio asset recovery tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        std::filesystem::remove_all(root);
        return 1;
    }
}
