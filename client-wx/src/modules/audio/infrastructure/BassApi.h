#pragma once

#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wpedantic"
#endif
#include <bass.h>
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif

namespace lila::modules::audio::infrastructure::bass
{
[[nodiscard]] bool Available() noexcept;
DWORD GetVersion() noexcept;
int ErrorGetCode() noexcept;
BOOL Init(int, DWORD, DWORD, void*, const void*) noexcept;
BOOL Free() noexcept;
BOOL Stop() noexcept;
HSAMPLE SampleLoad(DWORD, const void*, QWORD, DWORD, DWORD, DWORD) noexcept;
BOOL SampleFree(HSAMPLE) noexcept;
BOOL SampleGetInfo(HSAMPLE, BASS_SAMPLE*) noexcept;
DWORD SampleGetChannel(HSAMPLE, DWORD) noexcept;
DWORD SampleGetChannels(HSAMPLE, HCHANNEL*) noexcept;
BOOL SampleStop(HSAMPLE) noexcept;
HSTREAM StreamCreateFile(DWORD, const void*, QWORD, QWORD, DWORD) noexcept;
BOOL StreamFree(HSTREAM) noexcept;
DWORD ChannelIsActive(DWORD) noexcept;
BOOL ChannelPlay(DWORD, BOOL) noexcept;
BOOL ChannelPause(DWORD) noexcept;
BOOL ChannelStop(DWORD) noexcept;
BOOL ChannelSetAttribute(DWORD, DWORD, float) noexcept;
BOOL ChannelSetPosition(DWORD, QWORD, DWORD) noexcept;
}

#ifndef LILA_BASS_API_IMPLEMENTATION
#define BASS_GetVersion() ::lila::modules::audio::infrastructure::bass::GetVersion()
#define BASS_ErrorGetCode() ::lila::modules::audio::infrastructure::bass::ErrorGetCode()
#define BASS_Init(...) ::lila::modules::audio::infrastructure::bass::Init(__VA_ARGS__)
#define BASS_Free() ::lila::modules::audio::infrastructure::bass::Free()
#define BASS_Stop() ::lila::modules::audio::infrastructure::bass::Stop()
#define BASS_SampleLoad(...) ::lila::modules::audio::infrastructure::bass::SampleLoad(__VA_ARGS__)
#define BASS_SampleFree(...) ::lila::modules::audio::infrastructure::bass::SampleFree(__VA_ARGS__)
#define BASS_SampleGetInfo(...) ::lila::modules::audio::infrastructure::bass::SampleGetInfo(__VA_ARGS__)
#define BASS_SampleGetChannel(...) ::lila::modules::audio::infrastructure::bass::SampleGetChannel(__VA_ARGS__)
#define BASS_SampleGetChannels(...) ::lila::modules::audio::infrastructure::bass::SampleGetChannels(__VA_ARGS__)
#define BASS_SampleStop(...) ::lila::modules::audio::infrastructure::bass::SampleStop(__VA_ARGS__)
#define BASS_StreamCreateFile(...) ::lila::modules::audio::infrastructure::bass::StreamCreateFile(__VA_ARGS__)
#define BASS_StreamFree(...) ::lila::modules::audio::infrastructure::bass::StreamFree(__VA_ARGS__)
#define BASS_ChannelIsActive(...) ::lila::modules::audio::infrastructure::bass::ChannelIsActive(__VA_ARGS__)
#define BASS_ChannelPlay(...) ::lila::modules::audio::infrastructure::bass::ChannelPlay(__VA_ARGS__)
#define BASS_ChannelPause(...) ::lila::modules::audio::infrastructure::bass::ChannelPause(__VA_ARGS__)
#define BASS_ChannelStop(...) ::lila::modules::audio::infrastructure::bass::ChannelStop(__VA_ARGS__)
#define BASS_ChannelSetAttribute(...) ::lila::modules::audio::infrastructure::bass::ChannelSetAttribute(__VA_ARGS__)
#define BASS_ChannelSetPosition(...) ::lila::modules::audio::infrastructure::bass::ChannelSetPosition(__VA_ARGS__)
#endif
