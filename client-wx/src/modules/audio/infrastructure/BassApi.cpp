#define LILA_BASS_API_IMPLEMENTATION
#include "modules/audio/infrastructure/BassApi.h"

#include <cstring>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>
#endif

namespace lila::modules::audio::infrastructure::bass
{
namespace
{
#ifdef _WIN32
HMODULE Module() noexcept
{
    static HMODULE module = []() noexcept
    {
        wchar_t disabled[2]{};
        if (GetEnvironmentVariableW(L"LILA_DISABLE_BASS", disabled, 2) > 0 &&
            disabled[0] == L'1')
            return static_cast<HMODULE>(nullptr);
        return LoadLibraryExW(L"bass.dll", nullptr,
            LOAD_LIBRARY_SEARCH_APPLICATION_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);
    }();
    return module;
}
template<typename Function>
Function Resolve(const char* name) noexcept
{
    const auto module = Module();
    if (module == nullptr) return nullptr;

    const auto address = GetProcAddress(module, name);
    static_assert(sizeof(address) == sizeof(Function));
    Function function = nullptr;
    std::memcpy(&function, &address, sizeof(function));
    return function;
}
#else
void* Module() noexcept { return nullptr; }
template<typename Function>
Function Resolve(const char*) noexcept { return nullptr; }
#endif
}

bool Available() noexcept { return Module() != nullptr; }

#define LILA_BASS_CALL(returnType, name, fallback, parameters, arguments) \
    returnType name parameters noexcept { \
        using Function = returnType (WINAPI*) parameters; \
        static const auto function = Resolve<Function>("BASS_" #name); \
        return function == nullptr ? fallback : function arguments; \
    }

LILA_BASS_CALL(DWORD, GetVersion, 0, (), ())
LILA_BASS_CALL(int, ErrorGetCode, -1, (), ())
LILA_BASS_CALL(BOOL, Init, FALSE, (int device, DWORD frequency, DWORD flags, void* window, const void* deviceId), (device, frequency, flags, window, deviceId))
LILA_BASS_CALL(BOOL, Free, FALSE, (), ())
LILA_BASS_CALL(BOOL, Stop, FALSE, (), ())
LILA_BASS_CALL(HSAMPLE, SampleLoad, 0, (DWORD fileType, const void* file, QWORD offset, DWORD length, DWORD maximum, DWORD flags), (fileType, file, offset, length, maximum, flags))
LILA_BASS_CALL(BOOL, SampleFree, FALSE, (HSAMPLE handle), (handle))
LILA_BASS_CALL(BOOL, SampleGetInfo, FALSE, (HSAMPLE handle, BASS_SAMPLE* information), (handle, information))
LILA_BASS_CALL(DWORD, SampleGetChannel, 0, (HSAMPLE handle, DWORD flags), (handle, flags))
LILA_BASS_CALL(DWORD, SampleGetChannels, 0, (HSAMPLE handle, HCHANNEL* channels), (handle, channels))
LILA_BASS_CALL(BOOL, SampleStop, FALSE, (HSAMPLE handle), (handle))
LILA_BASS_CALL(HSTREAM, StreamCreateFile, 0, (DWORD fileType, const void* file, QWORD offset, QWORD length, DWORD flags), (fileType, file, offset, length, flags))
LILA_BASS_CALL(BOOL, StreamFree, FALSE, (HSTREAM handle), (handle))
LILA_BASS_CALL(DWORD, ChannelIsActive, BASS_ACTIVE_STOPPED, (DWORD handle), (handle))
LILA_BASS_CALL(BOOL, ChannelPlay, FALSE, (DWORD handle, BOOL restart), (handle, restart))
LILA_BASS_CALL(BOOL, ChannelPause, FALSE, (DWORD handle), (handle))
LILA_BASS_CALL(BOOL, ChannelStop, FALSE, (DWORD handle), (handle))
LILA_BASS_CALL(BOOL, ChannelSetAttribute, FALSE, (DWORD handle, DWORD attribute, float value), (handle, attribute, value))
LILA_BASS_CALL(BOOL, ChannelSetPosition, FALSE, (DWORD handle, QWORD position, DWORD mode), (handle, position, mode))

#undef LILA_BASS_CALL
}
