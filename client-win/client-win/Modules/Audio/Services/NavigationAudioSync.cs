using System;
using client_win.Modules.Audio.Models;
using client_win.Modules.Catalog.Views;
using client_win.Modules.Catalog.ViewModels;
using client_win.Modules.MainMenu.Views;
using client_win.Modules.MainMenu.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Audio.Services;

public sealed class NavigationAudioSync : IDisposable
{
    private readonly INavigationService _navigation;
    private readonly IAppAudioCoordinator _audio;
    private object? _lastContent;

    public NavigationAudioSync(INavigationService navigation, IAppAudioCoordinator audio)
    {
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _audio = audio ?? throw new ArgumentNullException(nameof(audio));
        _navigation.CurrentContentChanged += OnCurrentContentChanged;
    }

    private void OnCurrentContentChanged(object? sender, object? content)
    {
        try
        {
            var last = _lastContent;
            _lastContent = content;

            // IMPORTANT: set the desired background first, then emit the "entered tavern" one-shot.
            // This avoids a race where NotifyTavernEntered() requests a transition while the desired
            // background is still the previous screen.
            _audio.SetBackground(content switch
            {
                CatalogView or CatalogViewModel => AppAudioBackground.Tavern,
                MainMenuView or MainMenuViewModel => AppAudioBackground.MainMenu,
                _ => AppAudioBackground.None
            });

            if (IsCatalog(content) && !IsCatalog(last))
            {
                _audio.NotifyTavernEntered();
            }
        }
        catch
        {
            // best-effort
        }
    }

    private static bool IsCatalog(object? content) =>
        content is CatalogView or CatalogViewModel;

    public void Dispose()
    {
        try
        {
            _navigation.CurrentContentChanged -= OnCurrentContentChanged;
        }
        catch
        {
            // best-effort
        }
    }
}
