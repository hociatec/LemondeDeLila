using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Admin.Dtos;
using client_win.Modules.Admin.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Admin.ViewModels;

public enum AdminNavResult
{
    Stay,
    Moved,
    Closed
}

internal enum AdminPage
{
    Root,
    Games,
    GameActions,
    EditText,
    EditPlayers,
    Roles,
    Users,
    UserActions,
    BanForm,
    Broadcast,
    Logs,
    RoleDefinitions,
    RoleDefinitionActions,
    RoleDefinitionForm
}

public sealed class AdminViewModel : ObservableObject
{
    private readonly IAdminService _admin;
    private readonly IDialogService _dialogs;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;

    private AdminPage _page = AdminPage.Root;
    private string _title = "Administration";
    private string _status = string.Empty;
    private string _details = string.Empty;
    private bool _isBusy;

    private AdminUserDto? _selectedUser;
    private AdminUserDto[] _loadedUsers = Array.Empty<AdminUserDto>();
    private AdminGameDto[] _loadedGames = Array.Empty<AdminGameDto>();
    private AdminGameDto? _selectedGame;
    private AdminRoleDefinitionDto[] _loadedRoleDefinitions = Array.Empty<AdminRoleDefinitionDto>();
    private AdminRoleDefinitionDto? _selectedRoleDefinition;
    private string _roleDefinitionFormMode = string.Empty;
    private string _roleDefinitionOriginalName = string.Empty;

    private string _primaryInputLabel = string.Empty;
    private string _primaryInput = string.Empty;
    private string _secondaryInputLabel = string.Empty;
    private string _secondaryInput = string.Empty;
    private bool _isPrimaryInputVisible;
    private bool _isSecondaryInputVisible;
    private string _ternaryInputLabel = string.Empty;
    private string _ternaryInput = string.Empty;
    private bool _isTernaryInputVisible;
    private List<string> _availableRoles = new();
    private HashSet<string> _currentRoleSet = new();
    private string _filterSearch = string.Empty;
    private string _filterRole = string.Empty;
    private string _filterStatus = "all";
    private string _filterCreatedAfter = string.Empty;
    private string _filterCreatedBefore = string.Empty;
    private int _logLines = 200;
    private string _logFilter = string.Empty;

    public AdminViewModel(IAdminService admin, IDialogService dialogs, Action onClose)
    {
        _admin = admin ?? throw new ArgumentNullException(nameof(admin));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        Items = new ObservableCollection<AdminMenuItem>();
        ActivateCommand = new AsyncRelayCommand(ActivateSelectedAsync);
        ApplyFiltersCommand = new AsyncRelayCommand(ApplyFiltersAsync);
        DownloadLogsCommand = new AsyncRelayCommand(DownloadLogsAsync);

        BuildRoot();
    }

    public ObservableCollection<AdminMenuItem> Items { get; }

    public AdminMenuItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }
    private AdminMenuItem? _selectedItem;

    public string Title
    {
        get => _title;
        private set => SetProperty(ref _title, value);
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public string Details
    {
        get => _details;
        private set => SetProperty(ref _details, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set => SetProperty(ref _isBusy, value);
    }

    public string TextInputLabel
    {
        get => _primaryInputLabel;
        private set => SetProperty(ref _primaryInputLabel, value);
    }

    public string TextInput
    {
        get => _primaryInput;
        set => SetProperty(ref _primaryInput, value);
    }

    public string SecondaryInputLabel
    {
        get => _secondaryInputLabel;
        private set => SetProperty(ref _secondaryInputLabel, value);
    }

    public string SecondaryInput
    {
        get => _secondaryInput;
        set => SetProperty(ref _secondaryInput, value);
    }

    public bool IsTextInputVisible
    {
        get => _isPrimaryInputVisible;
        private set => SetProperty(ref _isPrimaryInputVisible, value);
    }

    public bool IsSecondaryInputVisible
    {
        get => _isSecondaryInputVisible;
        private set => SetProperty(ref _isSecondaryInputVisible, value);
    }

    public string TernaryInputLabel
    {
        get => _ternaryInputLabel;
        private set => SetProperty(ref _ternaryInputLabel, value);
    }

    public string TernaryInput
    {
        get => _ternaryInput;
        set => SetProperty(ref _ternaryInput, value);
    }

    public bool IsTernaryInputVisible
    {
        get => _isTernaryInputVisible;
        private set => SetProperty(ref _isTernaryInputVisible, value);
    }

    public string FilterSearch
    {
        get => _filterSearch;
        set => SetProperty(ref _filterSearch, value);
    }

    public string FilterRole
    {
        get => _filterRole;
        set => SetProperty(ref _filterRole, value);
    }

    public string FilterStatus
    {
        get => _filterStatus;
        set => SetProperty(ref _filterStatus, value);
    }

    public string FilterCreatedAfter
    {
        get => _filterCreatedAfter;
        set => SetProperty(ref _filterCreatedAfter, value);
    }

    public string FilterCreatedBefore
    {
        get => _filterCreatedBefore;
        set => SetProperty(ref _filterCreatedBefore, value);
    }

    public int LogLines
    {
        get => _logLines;
        set => SetProperty(ref _logLines, value);
    }

    public string LogFilter
    {
        get => _logFilter;
        set => SetProperty(ref _logFilter, value);
    }

    public bool ShowUserFilters => _page == AdminPage.Users || _page == AdminPage.Roles;
    public bool ShowLogControls => _page == AdminPage.Logs;

    public AsyncRelayCommand ActivateCommand { get; }
    public AsyncRelayCommand ApplyFiltersCommand { get; }
    public AsyncRelayCommand DownloadLogsCommand { get; }

    public AdminNavResult HandleEscape()
    {
        if (_page is AdminPage.UserActions or AdminPage.BanForm)
        {
            ShowUsers();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.GameActions or AdminPage.EditText or AdminPage.EditPlayers)
        {
            ShowGames();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Roles)
        {
            ShowUsers();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoleDefinitionForm)
        {
            if (string.Equals(_roleDefinitionFormMode, "edit", StringComparison.OrdinalIgnoreCase) && _selectedRoleDefinition != null)
            {
                BuildRoleDefinitionActions(_selectedRoleDefinition);
            }
            else
            {
                ShowRoleDefinitionsList();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoleDefinitionActions)
        {
            ShowRoleDefinitionsList();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoleDefinitions)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Logs)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.Games or AdminPage.Users or AdminPage.Broadcast)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        _close();
        return AdminNavResult.Closed;
    }

    private void BuildRoot()
    {
        _page = AdminPage.Root;
        Title = "Administration";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        IsTernaryInputVisible = false;
        IsTernaryInputVisible = false;
        IsTernaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Gérer les jeux", tag: "games"));
        Items.Add(new AdminMenuItem("Gérer les utilisateurs", tag: "users"));
        Items.Add(new AdminMenuItem("Envoyer un message global", tag: "broadcast"));
        Items.Add(new AdminMenuItem("Gérer les rôles", tag: "rolesDefinitions"));
        Items.Add(new AdminMenuItem("Consulter les logs", tag: "logs"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
    }

    private void UpdateFilterVisibility()
    {
        OnPropertyChanged(nameof(ShowUserFilters));
        OnPropertyChanged(nameof(ShowLogControls));
    }

    private async Task ActivateSelectedAsync()
    {
        if (IsBusy) return;
        var tag = SelectedItem?.Tag;
        if (tag == null) return;

        try
        {
            if (_page == AdminPage.Root)
            {
                if (tag is string s && s == "games")
                {
                    await LoadGamesAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s2 && s2 == "users")
                {
                    await LoadUsersAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s3 && s3 == "broadcast")
                {
                    BuildBroadcast();
                    return;
                }
                if (tag is string s4 && s4 == "rolesDefinitions")
                {
                    await LoadRoleDefinitionsAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s5 && s5 == "logs")
                {
                    ShowLogs();
                    return;
                }
            }

            if (_page == AdminPage.Games && tag is AdminGameDto game)
            {
                BuildGameActions(game);
                return;
            }

            if (_page == AdminPage.GameActions && _selectedGame != null && tag is string gameAction)
            {
                await ExecuteGameActionAsync(_selectedGame, gameAction).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.EditText && _selectedGame != null && tag is string editTag && editTag == "game.edit.submit")
            {
                await SubmitGameTextEditAsync(_selectedGame).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.EditPlayers && _selectedGame != null && tag is string editPlayersTag && editPlayersTag == "game.players.submit")
            {
                await SubmitGamePlayersAsync(_selectedGame).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Users && tag is AdminUserDto user)
            {
                BuildUserActions(user);
                return;
            }
            if (_page == AdminPage.Users && tag is string userTag && userTag == "filters")
            {
                ShowFilterReminder();
                return;
            }

            if (_page == AdminPage.UserActions && _selectedUser != null && tag is string act)
            {
                await ExecuteUserActionAsync(_selectedUser, act).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Roles && _selectedUser != null && tag is string role)
            {
                await ToggleRoleAsync(_selectedUser, role).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.BanForm && _selectedUser != null && tag is string banTag && banTag == "ban.submit")
            {
                await SubmitBanAsync(_selectedUser).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Broadcast && tag is string sendTag && sendTag == "broadcast.send")
            {
                await SendBroadcastAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.Logs && tag is string logTag && logTag == "logs.download")
            {
                await DownloadLogsAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.RoleDefinitions)
            {
                if (tag is string action && action == "roleDefinition.create")
                {
                    BuildRoleDefinitionForm("create");
                    return;
                }
                if (tag is AdminRoleDefinitionDto definition)
                {
                    BuildRoleDefinitionActions(definition);
                    return;
                }
            }

            if (_page == AdminPage.RoleDefinitionActions && _selectedRoleDefinition != null && tag is string roleAction)
            {
                if (roleAction == "roleDefinition.edit")
                {
                    BuildRoleDefinitionForm("edit", _selectedRoleDefinition);
                    return;
                }
                if (roleAction == "roleDefinition.delete")
                {
                    await DeleteRoleDefinitionAsync(_selectedRoleDefinition).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.RoleDefinitionForm && tag is string formTag && formTag == "roleDefinition.submit")
            {
                await SubmitRoleDefinitionFormAsync().ConfigureAwait(true);
                return;
            }
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Administration", ex.Message).ConfigureAwait(true);
        }
    }

    private async Task ApplyFiltersAsync()
    {
        if (!ShowUserFilters || IsBusy)
        {
            return;
        }
        await LoadUsersAsync().ConfigureAwait(true);
    }

    private async Task DownloadLogsAsync()
    {
        if (IsBusy)
        {
            return;
        }
        IsBusy = true;
        try
        {
            var linesCount = Math.Max(1, LogLines);
            var filter = string.IsNullOrWhiteSpace(LogFilter) ? null : LogFilter.Trim();
            var payload = await _admin.DownloadLogsAsync(linesCount, filter).ConfigureAwait(true);
            var preview = payload.Lines.Count > 0
                ? string.Join(Environment.NewLine, payload.Lines)
                : "(aucune ligne retournée)";

            var header = $"Fichier : {payload.File} ({payload.Total} lignes, affichage {payload.Lines.Count})";
            await _dialogs.ShowInfo("Logs", $"{header}{Environment.NewLine}{Environment.NewLine}{preview}")
                .ConfigureAwait(true);
            Status = $"Logs {payload.File} chargés ({payload.Lines.Count}/{payload.Total})";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadGamesAsync()
    {
        _page = AdminPage.Games;
        Title = "Gestion des jeux";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
            IsBusy = true;
        try
        {
            var list = await _admin.ListGamesAsync().ConfigureAwait(true);
            _loadedGames = (list.Games ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                Items.Clear();
                foreach (var game in _loadedGames.OrderBy(g => g.Name))
                {
                    var label = $"{(game.Enabled ? "Actif" : "Désactivé")} : {game.Name} ({game.Id})";
                    Items.Add(new AdminMenuItem(label, tag: game));
                }
                if (Items.Count == 0)
                {
                    Items.Add(new AdminMenuItem("Aucun jeu."));
                }
                SelectedItem = Items.FirstOrDefault();
                Status = "Entrée : options du jeu. Échap : retour.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowGames()
    {
        _page = AdminPage.Games;
        Title = "Gestion des jeux";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        foreach (var game in _loadedGames.OrderBy(g => g.Name))
        {
            var label = $"{(game.Enabled ? "Actif" : "Désactivé")} : {game.Name} ({game.Id})";
            Items.Add(new AdminMenuItem(label, tag: game));
        }
        if (Items.Count == 0)
        {
            Items.Add(new AdminMenuItem("Aucun jeu."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : options du jeu. Échap : retour.";
        UpdateFilterVisibility();
    }

    private void BuildGameActions(AdminGameDto game)
    {
        _page = AdminPage.GameActions;
        _selectedGame = game;
        Title = $"Jeu : {game.Name}";
        Details = $"Type: {game.Id}. Joueurs: {game.MinPlayers ?? 0}-{game.MaxPlayers ?? 0}. Statut: {(game.Enabled ? "actif" : "désactivé")}.";
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem(game.Enabled ? "Désactiver" : "Activer", tag: "game.toggle"));
        Items.Add(new AdminMenuItem("Modifier le nom", tag: "game.edit.name"));
        Items.Add(new AdminMenuItem("Modifier la description", tag: "game.edit.description"));
        Items.Add(new AdminMenuItem("Modifier min/max joueurs", tag: "game.edit.players"));
        Items.Add(new AdminMenuItem("Réinitialiser les paramètres", tag: "game.reset"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
    }

    private async Task ExecuteGameActionAsync(AdminGameDto game, string action)
    {
        if (action == "game.toggle")
        {
            IsBusy = true;
            try
            {
                await _admin.SetGameEnabledAsync(game.Id, !game.Enabled).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                var updated = _loadedGames.FirstOrDefault(g => string.Equals(g.Id, game.Id, StringComparison.OrdinalIgnoreCase));
                if (updated != null)
                {
                    BuildGameActions(updated);
                }
                await _dialogs.ShowInfo("Jeu", $"{game.Name} est {(game.Enabled ? "désactivé" : "activé")}.");
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (action == "game.edit.name")
        {
            BuildEditText(game, title: $"Nom : {game.Name}", label: "Nouveau nom", initialValue: game.Name, mode: "name");
            return;
        }
        if (action == "game.edit.description")
        {
            BuildEditText(game, title: $"Description : {game.Name}", label: "Nouvelle description", initialValue: game.Description ?? string.Empty, mode: "description");
            return;
        }
        if (action == "game.edit.players")
        {
            BuildEditPlayers(game);
            return;
        }
        if (action == "game.reset")
        {
            var confirm = await _dialogs.Confirm("Réinitialiser", $"Réinitialiser les paramètres admin pour {game.Name} ?").ConfigureAwait(true);
            if (confirm != true) return;
            IsBusy = true;
            try
            {
                await _admin.ResetGameOverrideAsync(game.Id).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                var updated = _loadedGames.FirstOrDefault(g => string.Equals(g.Id, game.Id, StringComparison.OrdinalIgnoreCase));
                if (updated != null)
                {
                    BuildGameActions(updated);
                }
                await _dialogs.ShowInfo("Jeu", $"Paramètres réinitialisés pour {game.Name}.");
            }
            finally
            {
                IsBusy = false;
            }
        }
    }

    private void BuildEditText(AdminGameDto game, string title, string label, string initialValue, string mode)
    {
        _page = AdminPage.EditText;
        _selectedGame = game;
        Title = title;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "game.edit.submit"));
        Items.Add(new AdminMenuItem($"Mode: {mode}", tag: mode));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = label;
        TextInput = initialValue;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        Details = $"Type: {game.Id}";
        Status = "Saisissez puis Entrée pour valider. Échap : retour.";
    }

    private async Task SubmitGameTextEditAsync(AdminGameDto game)
    {
        var mode = Items.FirstOrDefault(i => i.Tag is string s && (s == "name" || s == "description"))?.Tag as string;
        var value = (TextInput ?? string.Empty).Trim();
        if (mode == "name")
        {
            IsBusy = true;
            try
            {
                await _admin.UpdateGameAsync(game.Id, name: value).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                await _dialogs.ShowInfo("Jeu", $"Nom mis à jour pour {game.Name}.");
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }
        if (mode == "description")
        {
            IsBusy = true;
            try
            {
                await _admin.UpdateGameAsync(game.Id, description: value).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                await _dialogs.ShowInfo("Jeu", $"Description mise à jour pour {game.Name}.");
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }
    }

    private void BuildEditPlayers(AdminGameDto game)
    {
        _page = AdminPage.EditPlayers;
        _selectedGame = game;
        Title = $"Joueurs : {game.Name}";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "game.players.submit"));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = "Min joueurs";
        TextInput = (game.MinPlayers ?? 1).ToString();
        SecondaryInputLabel = "Max joueurs";
        SecondaryInput = (game.MaxPlayers ?? 2).ToString();
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        Details = $"Type: {game.Id}";
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitGamePlayersAsync(AdminGameDto game)
    {
        if (!int.TryParse((TextInput ?? string.Empty).Trim(), out var min) || min <= 0 ||
            !int.TryParse((SecondaryInput ?? string.Empty).Trim(), out var max) || max <= 0)
        {
            await _dialogs.ShowError("Joueurs", "Min/Max invalides.").ConfigureAwait(true);
            return;
        }
        if (min > max)
        {
            await _dialogs.ShowError("Joueurs", "Min ne peut pas être supérieur à Max.").ConfigureAwait(true);
            return;
        }

        IsBusy = true;
        try
        {
            await _admin.UpdateGameAsync(game.Id, minPlayers: min, maxPlayers: max).ConfigureAwait(true);
            await LoadGamesAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Jeu", $"Plage de joueurs mise à jour pour {game.Name}: {min}-{max}.");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadUsersAsync()
    {
        if (IsBusy)
        {
            return;
        }

        _page = AdminPage.Users;
        Title = "Gestion des utilisateurs";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
        IsBusy = true;
        try
        {
            var search = string.IsNullOrWhiteSpace(FilterSearch) ? null : FilterSearch.Trim();
            var role = string.IsNullOrWhiteSpace(FilterRole) ? null : FilterRole.Trim();
            var status = string.Equals(FilterStatus, "all", StringComparison.OrdinalIgnoreCase) ? null : FilterStatus;

            string? after = null;
            if (!string.IsNullOrWhiteSpace(FilterCreatedAfter))
            {
                if (!DateTime.TryParse(FilterCreatedAfter, out var parsedAfter))
                {
                    await _dialogs.ShowError("Filtres", "Date « créé après » invalide.").ConfigureAwait(true);
                    return;
                }
                after = parsedAfter.ToString("o");
            }

            string? before = null;
            if (!string.IsNullOrWhiteSpace(FilterCreatedBefore))
            {
                if (!DateTime.TryParse(FilterCreatedBefore, out var parsedBefore))
                {
                    await _dialogs.ShowError("Filtres", "Date « créé avant » invalide.").ConfigureAwait(true);
                    return;
                }
                before = parsedBefore.ToString("o");
            }

            var res = await _admin.ListUsersAsync(
                    search: search,
                    role: role,
                    status: status,
                    createdAfter: after,
                    createdBefore: before,
                    page: 1,
                    limit: 50)
                .ConfigureAwait(true);

            _loadedUsers = (res.Items ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                Items.Clear();
                Items.Add(new AdminMenuItem("Filtres utilisateurs (Entrée pour plus d'infos)", tag: "filters"));
                foreach (var user in _loadedUsers.OrderBy(u => u.Username))
                {
                    var roles = user.Roles != null && user.Roles.Count > 0 ? string.Join(',', user.Roles) : "ROLE_USER";
                    var banned = user.BannedUntil.HasValue ? $"Banni (jusqu'au {user.BannedUntil:yyyy-MM-dd})" : "Actif";
                    Items.Add(new AdminMenuItem($"{user.Username} (id {user.Id}) - {roles} - {banned}", tag: user));
                }
                if (Items.Count == 0)
                {
                    Items.Add(new AdminMenuItem("Aucun utilisateur."));
                }
                SelectedItem = Items.FirstOrDefault();
                Status = $"Affichage {Items.Count} / {res.Total} utilisateurs. Entrée : actions. Échap : retour.";
                UpdateFilterVisibility();
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowUsers()
    {
        _page = AdminPage.Users;
        Title = "Gestion des utilisateurs";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Filtres utilisateurs (Entrée pour plus d'infos)", tag: "filters"));
        foreach (var user in _loadedUsers.OrderBy(u => u.Username))
        {
            var roles = user.Roles != null && user.Roles.Count > 0 ? string.Join(',', user.Roles) : "ROLE_USER";
            var banned = user.BannedUntil.HasValue ? $"Banni (jusqu'au {user.BannedUntil:yyyy-MM-dd})" : "Actif";
            Items.Add(new AdminMenuItem($"{user.Username} (id {user.Id}) - {roles} - {banned}", tag: user));
        }
        if (Items.Count == 0)
        {
            Items.Add(new AdminMenuItem("Aucun utilisateur."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : actions. Échap : retour.";
        UpdateFilterVisibility();
    }

    private void BuildUserActions(AdminUserDto user)
    {
        _page = AdminPage.UserActions;
        _selectedUser = user;
        Title = $"Utilisateur : {user.Username}";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Bannir", tag: "ban"));
        Items.Add(new AdminMenuItem("Débannir", tag: "unban"));
        Items.Add(new AdminMenuItem("Supprimer", tag: "delete"));
        Items.Add(new AdminMenuItem("Modifier les rôles", tag: "roles"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : exécuter. Échap : retour.";
    }

    private async Task BuildRolesEditorAsync(AdminUserDto user)
    {
        await EnsureRolesLoadedAsync().ConfigureAwait(true);
        _page = AdminPage.Roles;
        _selectedUser = user;
        _currentRoleSet = new HashSet<string>(user.Roles ?? new List<string>());
        Title = $"Rôles : {user.Username}";
        Details = "Sélectionnez un rôle, Entrée pour basculer.";
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        RebuildRolesItems();
        UpdateFilterVisibility();
    }

    private void RebuildRolesItems()
    {
        Items.Clear();
        foreach (var role in _availableRoles)
        {
            var active = _currentRoleSet.Contains(role);
            var marker = active ? "✔" : " ";
            Items.Add(new AdminMenuItem($"{marker} {role}", tag: role));
        }
        if (Items.Count == 0)
        {
            Items.Add(new AdminMenuItem("Aucun rôle disponible."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : basculer. Échap : retour.";
    }

    private async Task ToggleRoleAsync(AdminUserDto user, string role)
    {
        if (!_availableRoles.Contains(role))
        {
            return;
        }
        var nextRoles = new HashSet<string>(_currentRoleSet);
        if (!nextRoles.Add(role))
        {
            nextRoles.Remove(role);
        }
        IsBusy = true;
        try
        {
            var updated = await _admin.UpdateUserRolesAsync(user.Id, nextRoles).ConfigureAwait(true);
            _selectedUser = updated;
            _currentRoleSet = new HashSet<string>(updated.Roles ?? new List<string>());
            _loadedUsers = _loadedUsers.Select(u => u.Id == updated.Id ? updated : u).ToArray();
            RebuildRolesItems();
            await _dialogs.ShowInfo("Rôles", $"Rôles mis à jour pour {user.Username}.").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task EnsureRolesLoadedAsync()
    {
        if (_availableRoles.Count > 0)
        {
            return;
        }
        var dto = await _admin.GetAvailableRolesAsync().ConfigureAwait(true);
        _availableRoles = dto.Roles ?? new List<string>();
    }

    private async Task ExecuteUserActionAsync(AdminUserDto user, string action)
    {
        if (action == "roles")
        {
            await BuildRolesEditorAsync(user).ConfigureAwait(true);
            return;
        }
        if (action == "ban")
        {
            BuildBanForm(user);
            return;
        }
        if (action == "unban")
        {
            await _admin.UnbanUserAsync(user.Id).ConfigureAwait(true);
            await LoadUsersAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Déban", $"{user.Username} est débanni.").ConfigureAwait(true);
            return;
        }
        if (action == "delete")
        {
            var confirm = await _dialogs.Confirm("Suppression", $"Supprimer {user.Username} ?").ConfigureAwait(true);
            if (confirm != true) return;
            await _admin.DeleteUserAsync(user.Id).ConfigureAwait(true);
            await LoadUsersAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Suppression", $"{user.Username} a été supprimé.");
        }
    }

    private void BuildBanForm(AdminUserDto user)
    {
        _page = AdminPage.BanForm;
        _selectedUser = user;
        Title = $"Bannir : {user.Username}";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider le ban", tag: "ban.submit"));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = "Motif (obligatoire)";
        TextInput = "Ban admin";
        SecondaryInputLabel = "Durée (jours)";
        SecondaryInput = "7";
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        Status = "Saisissez le motif et la durée (jours). Entrée : valider. Échap : retour.";
    }

    private async Task SubmitBanAsync(AdminUserDto user)
    {
        if (!int.TryParse(SecondaryInput?.Trim(), out var days) || days <= 0)
        {
            await _dialogs.ShowError("Ban", "Durée invalide (jours).").ConfigureAwait(true);
            return;
        }
        var reason = (TextInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(reason))
        {
            await _dialogs.ShowError("Ban", "Motif requis.").ConfigureAwait(true);
            return;
        }

        IsBusy = true;
        try
        {
            await _admin.BanUserAsync(user.Id, reason, days).ConfigureAwait(true);
            await LoadUsersAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Ban", $"{user.Username} est banni pendant {days} jour(s).").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowFilterReminder()
    {
        Status = "Utilise les champs de filtres en haut (recherche/role/statut/dates) puis Appliquer.";
        Details = "Les filtres modèrent la liste d'utilisateurs. Appuie sur Appliquer pour recharger.";
        UpdateFilterVisibility();
    }

    private void BuildBroadcast()
    {
        _page = AdminPage.Broadcast;
        Title = "Message global";
        Details = string.Empty;
        Items.Clear();
        Items.Add(new AdminMenuItem("Envoyer", tag: "broadcast.send"));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = "Message";
        TextInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        Status = "Saisissez le message. Entrée : envoyer. Échap : retour.";
    }

    private async Task SendBroadcastAsync()
    {
        var msg = (TextInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(msg))
        {
            await _dialogs.ShowError("Message global", "Message vide.").ConfigureAwait(true);
            return;
        }
        IsBusy = true;
        try
        {
            var delivered = await _admin.BroadcastAsync(msg).ConfigureAwait(true);
            await _dialogs.ShowInfo("Message global", $"Envoyé à {delivered} utilisateur(s).").ConfigureAwait(true);
            TextInput = string.Empty;
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowLogs()
    {
        _page = AdminPage.Logs;
        Title = "Logs serveurs";
        Details = "Télécharger les logs les plus récents.";
        IsTextInputVisible = false;
        IsTernaryInputVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Télécharger les logs", tag: "logs.download"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : télécharger. Échap : retour.";
        UpdateFilterVisibility();
    }
}
