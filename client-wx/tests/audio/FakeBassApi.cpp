#define LILA_BASS_API_IMPLEMENTATION
#include "modules/audio/infrastructure/BassApi.h"

#include <filesystem>
#include <string>
#include <unordered_map>

namespace lila::modules::audio::infrastructure::bass
{
namespace
{
DWORD nextHandle = 1;
std::unordered_map<HSAMPLE, DWORD> sampleLengths;

std::filesystem::path ReadPath(const void* file, DWORD flags)
{
    if (file == nullptr || (flags & BASS_UNICODE) == 0) return {};
    return std::filesystem::path(static_cast<const wchar_t*>(file));
}

bool IsLoadable(const std::filesystem::path& path)
{
    return std::filesystem::is_regular_file(path) &&
        path.filename() != L"corrupt-audio.bin";
}
}

bool Available() noexcept { return true; }
DWORD GetVersion() noexcept { return 1; }
int ErrorGetCode() noexcept { return 0; }
BOOL Init(int, DWORD, DWORD, void*, const void*) noexcept { return TRUE; }
BOOL Free() noexcept { sampleLengths.clear(); return TRUE; }
BOOL Stop() noexcept { return TRUE; }

HSAMPLE SampleLoad(DWORD, const void* file, QWORD, DWORD, DWORD, DWORD flags) noexcept
{
    const auto path = ReadPath(file, flags);
    if (!IsLoadable(path)) return 0;
    const auto handle = nextHandle++;
    sampleLengths[handle] = static_cast<DWORD>(std::filesystem::file_size(path));
    return handle;
}

BOOL SampleFree(HSAMPLE handle) noexcept
{
    sampleLengths.erase(handle);
    return TRUE;
}

BOOL SampleGetInfo(HSAMPLE handle, BASS_SAMPLE* information) noexcept
{
    const auto found = sampleLengths.find(handle);
    if (found == sampleLengths.end() || information == nullptr) return FALSE;
    information->length = found->second;
    return TRUE;
}

DWORD SampleGetChannel(HSAMPLE, DWORD) noexcept { return 0; }
DWORD SampleGetChannels(HSAMPLE, HCHANNEL*) noexcept { return 0; }
BOOL SampleStop(HSAMPLE) noexcept { return TRUE; }

HSTREAM StreamCreateFile(DWORD, const void* file, QWORD, QWORD, DWORD flags) noexcept
{
    return IsLoadable(ReadPath(file, flags)) ? nextHandle++ : 0;
}

BOOL StreamFree(HSTREAM) noexcept { return TRUE; }
DWORD ChannelIsActive(DWORD) noexcept { return BASS_ACTIVE_STOPPED; }
BOOL ChannelPlay(DWORD, BOOL) noexcept { return TRUE; }
BOOL ChannelPause(DWORD) noexcept { return TRUE; }
BOOL ChannelStop(DWORD) noexcept { return TRUE; }
BOOL ChannelSetAttribute(DWORD, DWORD, float) noexcept { return TRUE; }
BOOL ChannelSetPosition(DWORD, QWORD, DWORD) noexcept { return TRUE; }
}
