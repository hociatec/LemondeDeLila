using System;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private static readonly string[] CacheableShellViewModels =
    [
        "Modules.Home.ViewModels.HomeViewModel",
        "Modules.MainMenu.ViewModels.MainMenuViewModel",
        "Modules.Social.ViewModels.SocialViewModel",
        "Modules.Presence.ViewModels.PresenceViewModel",
        "Modules.Settings.ViewModels.OptionsViewModel",
        "Modules.About.ViewModels.AboutViewModel",
        "Modules.Admin.ViewModels.AdminViewModel",
        "Modules.Notifications.ViewModels.NotificationsViewModel",
        "Modules.Messaging.ViewModels.MessagingViewModel",
    ];

    private static readonly string[] PersistentShellViewModels =
    [
        "Modules.Home.ViewModels.HomeViewModel",
        "Modules.MainMenu.ViewModels.MainMenuViewModel",
        "Modules.Social.ViewModels.SocialViewModel",
        "Modules.Notifications.ViewModels.NotificationsViewModel",
        "Modules.Messaging.ViewModels.MessagingViewModel",
        "Modules.About.ViewModels.AboutViewModel",
    ];

    private static bool IsCacheable(object content)
    {
        if (content is IShellContentCachePolicy policy)
        {
            return policy.IsCacheable;
        }

        return MatchesShellViewModel(content, CacheableShellViewModels);
    }

    private static bool IsPersistentShellPage(object content)
    {
        if (content is IShellContentCachePolicy policy)
        {
            return policy.IsCacheable;
        }

        return MatchesShellViewModel(content, PersistentShellViewModels);
    }

    private static bool MatchesShellViewModel(
        object content,
        string[] candidates)
    {
        var type = content.GetType();
        var name = type.FullName ?? type.Name;
        foreach (var candidate in candidates)
        {
            if (name.Contains(candidate, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }
}
