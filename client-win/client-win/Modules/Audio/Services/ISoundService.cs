using client_win.Modules.Audio.Models;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Audio.Services;

public interface ISoundService
{
    void Play(SoundId sound);
    void Stop(SoundId sound);
    void PlayPreview(SoundId sound);
    void StopPreview();
    void SetConnected(bool connected);
    void OpenStartupGateForApp(string reason);
    void StartLoop(SoundId sound);
    void StopLoop(SoundId sound);
    void StopLoopImmediate(SoundId sound);
    TimeSpan? TryGetSoundDuration(SoundId sound);
    Task WaitForSoundToEndAsync(SoundId sound, TimeSpan timeout, CancellationToken cancellationToken = default);
    Task WarmUpAsync(SoundId sound, CancellationToken cancellationToken = default);
    void Preload(SoundId sound, bool warmUp = false);
    void PreloadImmediate(SoundId sound, bool warmUp = false);
    void PreloadAll();
}
