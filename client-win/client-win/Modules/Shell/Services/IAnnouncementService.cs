using System.Collections.Generic;

namespace client_win.Modules.Shell.Services;

public enum AnnouncementPriority
{
    Polite = 0,
    Assertive = 1
}

public interface IAnnouncementService
{
    bool IsAvailable { get; }
    void Enqueue(string message, AnnouncementPriority priority = AnnouncementPriority.Polite);
    void EnqueueMany(IEnumerable<string> messages, AnnouncementPriority priority = AnnouncementPriority.Polite);
    void CancelPending(bool cancelSpeech = false);
    void NotifyUserInteraction();
    void SetGameplayUltraReactive(bool enabled);
}

