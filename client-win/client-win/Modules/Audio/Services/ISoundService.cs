using client_win.Modules.Audio.Models;

namespace client_win.Modules.Audio.Services;

public interface ISoundService
{
    void Play(SoundId sound);
    void StartLoop(SoundId sound);
    void StopLoop(SoundId sound);
    void PreloadAll();
}
