namespace client_win.Modules.Shell.Services;

public interface IScreenReaderAnnouncer
{
    bool IsRunning { get; }
    void AnnouncePolite(string message);
    void AnnounceAssertive(string message);
    void CancelSpeech();
}
