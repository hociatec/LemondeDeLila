using client_win.Modules.Audio.Models;
using System;
using System.Threading.Tasks;

namespace client_win.Modules.Audio.Services;

public interface ISoundService
{
    void Play(SoundId sound);
    void PlayPreview(SoundId sound);
    void StopPreview();
    void StartLoop(SoundId sound);
    void StopLoop(SoundId sound);
    Task WaitForSoundToEndAsync(SoundId sound, TimeSpan timeout);
    void Preload(SoundId sound, bool warmUp = false);
    void PreloadAll();
}
