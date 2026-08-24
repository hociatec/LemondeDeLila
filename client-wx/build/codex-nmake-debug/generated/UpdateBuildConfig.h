#pragma once

namespace lila::modules::update
{
struct UpdateBuildConfig final
{
    static constexpr const char* BuildVersion = "1.2.651.0";
    static constexpr const char* PublicKeyDerBase64 = "";
    static constexpr const char* DefaultManifestUrl = "https://api.lilas.hociatec.fr/api/client/releases/latest?platform=windows&arch=x64";
};
}
