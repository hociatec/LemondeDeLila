#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>
#endif

#include <cassert>

#include "modules/audio/infrastructure/BassApi.h"
#ifndef LILA_BASS_WRAPPER_ONLY_TEST
#include "modules/audio/infrastructure/BassAudioBackend.h"
#endif

int main()
{
#ifdef _WIN32
    assert(SetEnvironmentVariableW(L"LILA_DISABLE_BASS", L"1"));
#endif
    using namespace lila::modules::audio::infrastructure;
    assert(!bass::Available());
    assert(BASS_GetVersion() == 0);
    assert(BASS_ErrorGetCode() == -1);
    assert(!BASS_Init(-1, 44'100, 0, nullptr, nullptr));
    assert(!BASS_Stop());
    assert(!BASS_Free());
    assert(!BASS_ChannelStop(1));

#ifndef LILA_BASS_WRAPPER_ONLY_TEST
    using lila::modules::audio::domain::SoundCue;
    BassAudioBackend backend;
    backend.Preload(SoundCue::ClientOpened);
    backend.Play(SoundCue::Selection, 1.0F);
    backend.SetLoop(SoundCue::MainMenuMusic, 0.5F);
    backend.Preview(SoundCue::DiceRolled);
    backend.SetPreviewVolume(0.25F);
    backend.TogglePreviewPause();
    backend.RefreshAssets();
    backend.StopAll();
    backend.InterruptPlayback();
    backend.Shutdown();
    backend.Shutdown();
#endif
}
