using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Collections.ObjectModel;
using System.Text.Json;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Catalog.Services;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.User.Models;
using Serilog;

namespace client_win.Modules.MainMenu.ViewModels;

public sealed class MainMenuViewModel : ObservableObject
{
    private readonly AuthenticatedUser _user;
    private readonly IMenuRouter _router;
    private readonly ICatalogService _catalog;
    private readonly Action? _logout;
    private string _statusMessage = "Prêt.";
    private bool _isAdminVisible;
    private bool _isBusy;
    private MainMenuItem? _selectedItem;

    public MainMenuViewModel(AuthenticatedUser user, IMenuRouter router, ICatalogService catalog, Action? logout = null)
    {
        _user = user ?? throw new ArgumentNullException(nameof(user));
        _router = router ?? throw new ArgumentNullException(nameof(router));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _logout = logout;
        _isAdminVisible = HasAdminRole(user.Token);

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
        SocialCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenSocial()));
        StatsCommand = new AsyncRelayCommand(async () => SetStatus(await _router.OpenStats()));
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
        BuildMenuItems();
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
    public ICommand SocialCommand { get; }
    public ICommand StatsCommand { get; }
    public ICommand AdminCommand { get; }
    public ICommand OptionsCommand { get; }
    public ICommand LogoutCommand { get; }

    public ObservableCollection<MainMenuItem> Items { get; }

    public MainMenuItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }

    public AsyncRelayCommand ActivateCommand { get; }

    private void SetStatus(string text) => StatusMessage = text;

    private void BuildMenuItems()
    {
        Items.Clear();

        Items.Add(new MainMenuItem("Étagères", tag: OpenCatalogCommand));
        Items.Add(new MainMenuItem("Rejoindre une partie", tag: JoinGameCommand));
        Items.Add(new MainMenuItem("Messagerie", tag: MessagingCommand));
        Items.Add(new MainMenuItem("Chat", tag: ChatCommand));
        Items.Add(new MainMenuItem("Social", tag: SocialCommand));
        Items.Add(new MainMenuItem("Livre des contes", tag: StatsCommand));

        if (_isAdminVisible)
        {
            Items.Add(new MainMenuItem("Administration", tag: AdminCommand));
        }

        Items.Add(new MainMenuItem("Options", tag: OptionsCommand));
        Items.Add(new MainMenuItem("Déconnexion", tag: LogoutCommand));

        SelectedItem = Items.FirstOrDefault();
        StatusMessage = "Entrée : sélectionner.";
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

    private bool HasAdminRole(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            var roleClaims = jwt.Claims.Where(c =>
                string.Equals(c.Type, "roles", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(c.Type, "role", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(c.Type, "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", StringComparison.OrdinalIgnoreCase));

            foreach (var claim in roleClaims)
            {
                var raw = (claim.Value ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(raw))
                {
                    continue;
                }

                // Backend uses roles as a JSON array in the JWT payload (ex: ["ROLE_ADMIN"]).
                if (raw.StartsWith("[", StringComparison.Ordinal))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(raw);
                        if (doc.RootElement.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var el in doc.RootElement.EnumerateArray())
                            {
                                var role = el.ValueKind == JsonValueKind.String ? (el.GetString() ?? string.Empty) : string.Empty;
                                if (IsAdminRole(role))
                                {
                                    return true;
                                }
                            }
                            continue;
                        }
                    }
                    catch
                    {
                        // fallback below
                    }
                }

                var roles = raw.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
                foreach (var role in roles)
                {
                    var cleaned = role.Trim().Trim('"', '\'', '[', ']', ' ');
                    if (IsAdminRole(cleaned))
                    {
                        return true;
                    }
                }
            }
        }
        catch
        {
            // JUSTIFICATION: Erreur attendue lors du parsing du JWT
            // Causes possibles: token malformé, format JWT invalide, claims manquants
            // RECOVERY: Traiter comme non-admin (comportement sécurisé par défaut)
            // Principe du "fail-safe" : en cas de doute, pas d'accès admin
            return false;
        }
        return false;
    }

    private static bool IsAdminRole(string role) =>
        string.Equals(role, "ROLE_ADMIN", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
}
