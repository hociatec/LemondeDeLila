using System;
using System.Windows.Controls;
using client_win.Modules.Audio.Models;
using client_win.Modules.Catalog.Views;
using client_win.Modules.MainMenu.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Audio.Services;

public sealed class NavigationAudioSync : IDisposable
{
    private readonly INavigationService _navigation;
    private readonly IAppAudioCoordinator _audio;

    public NavigationAudioSync(INavigationService navigation, IAppAudioCoordinator audio)
    {
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _audio = audio ?? throw new ArgumentNullException(nameof(audio));
        _navigation.CurrentViewChanged += OnCurrentViewChanged;
    }

    private void OnCurrentViewChanged(object? sender, UserControl? view)
    {
        try
        {
            _audio.SetBackground(view switch
            {
                CatalogView => AppAudioBackground.Tavern,
                MainMenuView => AppAudioBackground.MainMenu,
                _ => AppAudioBackground.None
            });
        }
        catch
        {
            // best-effort
        }
    }

    public void Dispose()
    {
        try
        {
            _navigation.CurrentViewChanged -= OnCurrentViewChanged;
        }
        catch
        {
            // best-effort
        }
    }
}

