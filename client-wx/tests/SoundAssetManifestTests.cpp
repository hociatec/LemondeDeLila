#include <iostream>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

#include "modules/audio/infrastructure/SoundAssetManifest.h"

namespace
{
using lila::modules::audio::infrastructure::MaximumRemoteSoundBytes;
using lila::modules::audio::infrastructure::MaximumRemoteSoundEntries;
using lila::modules::audio::infrastructure::ParseSoundAssetManifest;

void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

nlohmann::json Sound(std::size_t bytes = 1024)
{
    return {{"url", "/api/sounds/file"}, {"sha256", std::string(64, 'a')}, {"bytes", bytes}};
}
}

int main()
{
    try
    {
        const auto valid = ParseSoundAssetManifest(nlohmann::json{
            {"sounds", {{"clientOpened", Sound()}}},
            {"disabled", {"selection"}},
        }.dump());
        Expect(valid.has_value() && valid->sounds.size() == 1 &&
            valid->disabled.contains("selection"), "A valid audio manifest was rejected.");

        // Production catalogue: long table ambiences exceed the old 32 MiB
        // per-file and 128 MiB aggregate limits, without being preloaded.
        nlohmann::json largeCatalogue = nlohmann::json::object();
        for (int index = 1; index <= 20; ++index)
            largeCatalogue["TableAmbience" + std::to_string(index)] = Sound(25U * 1024U * 1024U);
        largeCatalogue["TableAmbience13"] = Sound(67'401'482);
        largeCatalogue["TableAmbience17"] = Sound(47'902'730);
        largeCatalogue["ClientOpened"] = Sound(1024);
        const auto large = ParseSoundAssetManifest(nlohmann::json{{"sounds", largeCatalogue}}.dump());
        Expect(large.has_value() && large->sounds.size() == 21 &&
            large->sounds.at("TableAmbience13").bytes == 67'401'482 &&
            large->sounds.contains("ClientOpened"),
            "Long ambiences must not disable the entire remote sound catalogue.");
        Expect(ParseSoundAssetManifest(nlohmann::json{{"sounds", {
            {"TableAmbience1", Sound(250U * 1024U * 1024U)}}}}.dump()).has_value(),
            "A WAV accepted at the server upload limit must be playable by the client.");

        Expect(!ParseSoundAssetManifest("{broken").has_value(),
            "A corrupted audio manifest was accepted.");
        Expect(!ParseSoundAssetManifest(nlohmann::json{{"sounds", {
            {"bad", Sound(MaximumRemoteSoundBytes + 1)}}}}.dump()).has_value(),
            "An oversized remote audio asset was accepted.");
        Expect(!ParseSoundAssetManifest(nlohmann::json{{"sounds", {
            {"bad", {{"url", "/sound"}, {"sha256", "invalid"}, {"bytes", 1}}}}}}.dump()).has_value(),
            "A corrupt audio hash was accepted.");

        nlohmann::json tooMany = nlohmann::json::object();
        for (std::size_t index = 0; index <= MaximumRemoteSoundEntries; ++index)
            tooMany["sound" + std::to_string(index)] = Sound(1);
        Expect(!ParseSoundAssetManifest(nlohmann::json{{"sounds", tooMany}}.dump()).has_value(),
            "An unbounded audio manifest was accepted.");

        std::cout << "Sound asset manifest tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "Sound asset manifest test failed: " << error.what() << '\n';
        return 1;
    }
}
