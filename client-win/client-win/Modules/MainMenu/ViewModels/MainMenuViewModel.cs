using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
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
    public ICommand AdminCommand { get; }
    public ICommand OptionsCommand { get; }
    public ICommand LogoutCommand { get; }

    private void SetStatus(string text) => StatusMessage = text;

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
                string.Equals(c.Type, "role", StringComparison.OrdinalIgnoreCase));

            foreach (var claim in roleClaims)
            {
                var roles = claim.Value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
                foreach (var role in roles)
                {
                    if (string.Equals(role, "ROLE_ADMIN", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
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
}
