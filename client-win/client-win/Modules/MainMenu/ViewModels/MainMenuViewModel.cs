using System;
using System.Linq;
using System.Collections.ObjectModel;
using System.Windows.Input;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Network.Services;
using client_win.Modules.Catalog.Services;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.User.Models;
using client_win.Modules.Shell.Services;
using Serilog;
using System.ComponentModel;

namespace client_win.Modules.MainMenu.ViewModels;

public sealed class MainMenuViewModel : ObservableObject
{
    private readonly AuthenticatedUser _user;
    private readonly IMenuRouter _router;
    private readonly ICatalogService _catalog;
    private readonly IApiCapabilitiesService _capabilities;
    private readonly IMenuBadges _badges;
    private readonly Action? _logout;
    private string _statusMessage = "Prêt.";
    private bool _isAdminVisible;
    private bool _isBusy;
    private MainMenuItem? _selectedItem;

    public MainMenuViewModel(
        AuthenticatedUser user,
        IMenuRouter router,
        ICatalogService catalog,
        IApiCapabilitiesService capabilities,
        IMenuBadges badges,
        Action? logout = null)
    {
        _user = user ?? throw new ArgumentNullException(nameof(user));
        _router = router ?? throw new ArgumentNullException(nameof(router));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _capabilities = capabilities ?? throw new ArgumentNullException(nameof(capabilities));
        _badges = badges ?? throw new ArgumentNullException(nameof(badges));
        _logout = logout;
        _isAdminVisible = false;

        OpenCatalogCommand = new AsyncRelayCommand(
            async () =>
            {
                // Ne pas bloquer l'ouverture sur le préchargement (qui peut prendre du temps si le WS est lent).
                StatusMessage = "Ouverture du catalogue...";
                SetStatus(await _router.OpenCatalog());
            },
            onException: ex =>
            {
                Log.Error(ex, "Erreur lors de l'ouverture du catalogue");
                StatusMessage = $"Erreur ouverture catalogue : {ex.Message}";
            });
        JoinGameCommand = new AsyncRelayCommand(async () => SetStatus(await _router.JoinGame()));
        ChatCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenChat()));
        MessagingCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenMessaging()));
        NotificationsCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenNotifications()));
        ContactAdminCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenContactAdmin()));
        SocialCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenSocial()));
        StatsCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenStats()));
        AboutCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenAbout()));
        AdminCommand = new AsyncRelayCommand(async () =>
        {
            if (!_isAdminVisible)
            {
                SetStatus("Accès admin refusé (rôle manquant).");
                return;
            }
            SetStatus(await _router.OpenAdmin());
        });
        OptionsCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenOptions()));
        LogoutCommand = new AsyncRelayCommand(async () =>
        {
            SetStatus(await _router.Logout());
            _logout?.Invoke();
        });

        Items = new ObservableCollection<MainMenuItem>();
        ActivateCommand = new AsyncRelayCommand(ActivateSelectedAsync);
        RefreshAdminVisibilityCommand = new AsyncRelayCommand(RefreshAdminVisibilityAsync, onException: ex =>
        {
            Log.Error(ex, "Erreur lors de la détection des droits admin");
        });
        BuildMenuItems();

        // Déclenche immédiatement la détection des droits admin à l'arrivée sur le menu.
        _ = RefreshAdminVisibilityCommand.ExecuteAsync(null);

        // Les badges (notifications/messagerie) sont mis à jour en arrière-plan.
        // Recréer la liste à chaque changement déclenche des annonces NVDA répétées.
    }

    public string Welcome => $"Bienvenue, {_user.Username}";

    public string Version => $"Version {AppInfo.GetDisplayVersion()}";

    public string StatusMessage
    {
        get => _statusMessage;
        private set => SetProperty(ref _statusMessage, value);
    }

    public bool IsAdminVisible
    {
        get => _isAdminVisible;
        private set => SetProperty(ref _isAdminVisible, value);
    }

    public ICommand OpenCatalogCommand { get; }
    public ICommand JoinGameCommand { get; }
    public ICommand ChatCommand { get; }
    public ICommand MessagingCommand { get; }
    public ICommand NotificationsCommand { get; }
    public ICommand ContactAdminCommand { get; }
    public ICommand SocialCommand { get; }
    public ICommand StatsCommand { get; }
    public ICommand AdminCommand { get; }
    public ICommand AboutCommand { get; }
    public ICommand OptionsCommand { get; }
    public ICommand LogoutCommand { get; }

    public ObservableCollection<MainMenuItem> Items { get; }

    public MainMenuItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }

    public AsyncRelayCommand ActivateCommand { get; }
    public AsyncRelayCommand RefreshAdminVisibilityCommand { get; }

    private void SetStatus(string text) => StatusMessage = text;

    private void BuildMenuItems()
    {
        Items.Clear();

        Items.Add(new MainMenuItem("Entrée dans la taverne", tag: OpenCatalogCommand));
        Items.Add(new MainMenuItem("Tchat", tag: ChatCommand));
        Items.Add(new MainMenuItem("Social", tag: SocialCommand));
        Items.Add(new MainMenuItem("À propos", tag: AboutCommand));
        if (IsAdminVisible)
        {
            Items.Add(new MainMenuItem("Administration", tag: AdminCommand));
        }
        Items.Add(new MainMenuItem("Options", tag: OptionsCommand));
        Items.Add(new MainMenuItem("Déconnexion", tag: LogoutCommand));

        SelectedItem = Items.FirstOrDefault();
        StatusMessage = "Flèches haut/bas : naviguer. Entrée : sélectionner.";
    }

    private static string FormatMenuLabel(string baseLabel, int unread)
    {
        unread = Math.Max(0, unread);
        return $"{baseLabel} ({unread})";
    }

    private async Task RefreshAdminVisibilityAsync()
    {
        var capabilities = await _capabilities.GetAsync().ConfigureAwait(true);
        var shouldShowAdmin = capabilities.IsAdmin;

        if (shouldShowAdmin == _isAdminVisible)
        {
            return;
        }

        IsAdminVisible = shouldShowAdmin;
        BuildMenuItems();
    }

    private async Task ActivateSelectedAsync()
    {
        if (_isBusy)
        {
            return;
        }

        var item = SelectedItem;
        if (item?.Tag is not ICommand cmd)
        {
            return;
        }

        _isBusy = true;
        try
        {
            // IMPORTANT (NVDA): éviter "indisponible" quand une navigation remplace la vue pendant un événement clavier.
            // Stratégie: ne pas déplacer le focus localement; sortir du traitement clavier via un passage dispatcher.
            try
            {
                var dispatcher = Application.Current?.Dispatcher;
                if (dispatcher != null)
                {
                    await dispatcher.InvokeAsync(() => { }, DispatcherPriority.Background).Task.ConfigureAwait(true);
                }
            }
            catch
            {
                // best-effort
            }

            if (cmd is AsyncRelayCommand asyncCmd)
            {
                await asyncCmd.ExecuteAsync(null).ConfigureAwait(true);
                return;
            }

            if (cmd.CanExecute(null))
            {
                cmd.Execute(null);
            }
        }
        finally
        {
            _isBusy = false;
        }
    }
}
