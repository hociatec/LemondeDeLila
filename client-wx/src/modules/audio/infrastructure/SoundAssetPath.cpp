#include "modules/audio/infrastructure/SoundAssetPath.h"

#include "modules/audio/infrastructure/LocalSoundManifest.h"

#ifdef _WIN32
#include <windows.h>
#endif

namespace lila::modules::audio::infrastructure
{
namespace
{
std::filesystem::path ExecutableDirectory()
{
#ifdef _WIN32
    std::wstring path(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
    if (length == 0 || length >= path.size())
    {
        return {};
    }
    path.resize(length);
    return std::filesystem::path(path).parent_path();
#else
    return {};
#endif
}
}

SoundAssetPathResolver::SoundAssetPathResolver()
    : soundDirectory_(ExecutableDirectory() / L"resources" / L"sounds")
{
}

std::filesystem::path SoundAssetPathResolver::Resolve(domain::SoundCue cue) const
{
    const auto file = GetLocalSoundFile(cue);
    return file.empty()
        ? std::filesystem::path{}
        : soundDirectory_ / file;
}
}
