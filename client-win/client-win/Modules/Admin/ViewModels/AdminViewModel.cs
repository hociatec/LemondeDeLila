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
using client_win.Modules.Updates;
using Microsoft.Win32;

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
    GameCategories,
    GameCategoryForm,
    GameCategoryAssign,
    GameActions,
    EditText,
    EditPlayers,
    Bots,
    BotNameActions,
    BotNameForm,
    BotSettingsForm,
    Roles,
    Users,
    UserActions,
    BanForm,
    Broadcast,
    ClientUpdates,
    Logs,
    RoleDefinitions,
    RoleDefinitionActions,
    RoleDefinitionForm
}

public sealed record PermissionModuleDescriptor(string ModuleId, string DisplayName, string Description);

public sealed class AdminViewModel : ObservableObject
{
    private readonly IAdminService _admin;
    private readonly IDialogService _dialogs;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private AdminPage _categoriesReturnPage = AdminPage.Games;

    private AdminPage _page = AdminPage.Root;
    private string _title = "Administration";
    private string _status = string.Empty;
    private string _details = string.Empty;
    private bool _isBusy;

    private AdminUserDto? _selectedUser;
    private AdminUserDto[] _loadedUsers = Array.Empty<AdminUserDto>();
    private AdminGameDto[] _loadedGames = Array.Empty<AdminGameDto>();
    private AdminGameDto? _selectedGame;
    private AdminGameCategoryDto[] _loadedCategories = Array.Empty<AdminGameCategoryDto>();
    private Dictionary<string, string?> _categoryAssignments = new();
    private string _categoryFormMode = string.Empty;
    private string _categoryFormId = string.Empty;
    private AdminBotNameDto[] _loadedBotNames = Array.Empty<AdminBotNameDto>();
    private AdminBotNameDto? _selectedBotName;
    private int _botTurnDelayMs = 4000;
    private string _botNameFormMode = string.Empty;
    private int _botNameFormId;
    private AdminRoleDefinitionDto[] _loadedRoleDefinitions = Array.Empty<AdminRoleDefinitionDto>();
    private AdminRoleDefinitionDto? _selectedRoleDefinition;
    private string _roleDefinitionFormMode = string.Empty;
    private string _roleDefinitionOriginalName = string.Empty;
    private string _currentEditMode = string.Empty;

    private string _primaryInputLabel = string.Empty;
    private string _primaryInput = string.Empty;
    private string _secondaryInputLabel = string.Empty;
    private string _secondaryInput = string.Empty;
    private bool _isPrimaryInputVisible;
    private bool _isSecondaryInputVisible;
    private List<string> _availableRoles = new();
    private HashSet<string> _currentRoleSet = new();
    private string _filterSearch = string.Empty;
    private string _filterRole = string.Empty;
    private string _filterStatus = "all";
    private string _filterCreatedAfter = string.Empty;
    private string _filterCreatedBefore = string.Empty;
    private static readonly PermissionModuleDescriptor[] PermissionModuleDescriptors =
    {
        new("admin.games", "Jeux", "Charger et configurer les tables"),
        new("admin.users", "Utilisateurs", "Lister, bannir, modifier les membres"),
        new("admin.roles", "Rôles", "Lire/écrire les définitions de rôle"),
        new("admin.logs", "Logs", "Télécharger et consulter les journaux"),
        new("admin.catalog", "Catalogue", "Valider l’état des jeux et catégories"),
        new("admin.stats", "Statistiques", "Consulter les statistiques"),
        new("admin.chat", "Chat", "Gérer et surveiller la messagerie"),
        new("game", "Parties", "Actions génériques sur les parties")
    };
    private readonly List<PermissionModuleState> _permissionModules = PermissionModuleDescriptors.Select(d => new PermissionModuleState(d)).ToList();
    private string _additionalPermissionsLabel = string.Empty;
    private string _additionalPermissions = string.Empty;
    private bool _isAdditionalPermissionsVisible;
    private int _logLines = 200;
    private string _logFilter = string.Empty;
    private readonly IClientUpdatePublisher _publisher;

    public AdminViewModel(IAdminService admin, IClientUpdatePublisher publisher, IDialogService dialogs, Action onClose)
    {
        _admin = admin ?? throw new ArgumentNullException(nameof(admin));
        _publisher = publisher ?? throw new ArgumentNullException(nameof(publisher));
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
    public bool ShowPermissionMatrix => IsAdditionalPermissionsVisible;

    public IEnumerable<PermissionModuleState> PermissionModules => _permissionModules;

    public string AdditionalPermissionsLabel
    {
        get => _additionalPermissionsLabel;
        private set => SetProperty(ref _additionalPermissionsLabel, value);
    }

    public string AdditionalPermissions
    {
        get => _additionalPermissions;
        set => SetProperty(ref _additionalPermissions, value);
    }

    public bool IsAdditionalPermissionsVisible
    {
        get => _isAdditionalPermissionsVisible;
        private set
        {
            if (SetProperty(ref _isAdditionalPermissionsVisible, value))
            {
                OnPropertyChanged(nameof(ShowPermissionMatrix));
            }
        }
    }

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

        if (_page == AdminPage.GameCategoryAssign)
        {
            if (_selectedGame != null)
            {
                BuildGameActions(_selectedGame);
            }
            else
            {
                ShowGames();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.GameCategoryForm)
        {
            ShowCategories();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.GameCategories)
        {
            if (_categoriesReturnPage == AdminPage.Root)
            {
                BuildRoot();
            }
            else
            {
                ShowGames();
            }
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.BotNameActions or AdminPage.BotNameForm or AdminPage.BotSettingsForm)
        {
            ShowBots();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Bots)
        {
            BuildRoot();
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

        if (_page is AdminPage.Games or AdminPage.Users or AdminPage.Broadcast or AdminPage.ClientUpdates)
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
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Gérer les catégories", tag: "categories"));
        Items.Add(new AdminMenuItem("Gérer les jeux", tag: "games"));
        Items.Add(new AdminMenuItem("Gérer les bots", tag: "bots"));
        Items.Add(new AdminMenuItem("Gérer les utilisateurs", tag: "users"));
        Items.Add(new AdminMenuItem("Envoyer un message global", tag: "broadcast"));
        Items.Add(new AdminMenuItem("Mises à jour client", tag: "clientUpdates"));
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
                if (tag is string rootCategories && rootCategories == "categories")
                {
                    await LoadCategoriesAsync(AdminPage.Root).ConfigureAwait(true);
                    return;
                }
                if (tag is string s && s == "games")
                {
                    await LoadGamesAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string bots && bots == "bots")
                {
                    await LoadBotsAsync().ConfigureAwait(true);
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
                if (tag is string cu && cu == "clientUpdates")
                {
                    BuildClientUpdates();
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

            if (_page == AdminPage.Games && tag is string gamesAction && gamesAction == "games.categories")
            {
                await LoadCategoriesAsync(AdminPage.Games).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Games && tag is AdminGameDto game)
            {
                BuildGameActions(game);
                return;
            }

            if (_page == AdminPage.GameActions && tag is string gameAction)
            {
                if (gameAction == "game.category.assign")
                {
                    await LoadCategoryAssignmentMenuAsync().ConfigureAwait(true);
                    return;
                }
                if (_selectedGame != null)
                {
                    await ExecuteGameActionAsync(_selectedGame, gameAction).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.GameCategories)
            {
                if (tag is string categoryAction && categoryAction == "games.categories.create")
                {
                    BuildCategoryForm("create");
                    return;
                }
                if (tag is AdminGameCategoryDto category)
                {
                    BuildCategoryForm("edit", category);
                    return;
                }
            }

            if (_page == AdminPage.GameCategoryForm && tag is string categoryFormTag && categoryFormTag == "game.category.submit")
            {
                await SubmitCategoryFormAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.GameCategoryAssign)
            {
                if (tag is string assignTag && assignTag == "game.category.assign.none")
                {
                    await AssignCategoryToGameAsync(null).ConfigureAwait(true);
                    return;
                }
                if (tag is AdminGameCategoryDto category)
                {
                    await AssignCategoryToGameAsync(category.Id).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.Bots)
            {
                if (tag is string botsAction && botsAction == "bots.settings")
                {
                    BuildBotSettingsForm();
                    return;
                }
                if (tag is string createBot && createBot == "bots.create")
                {
                    BuildBotNameForm("create");
                    return;
                }
                if (tag is AdminBotNameDto botName)
                {
                    BuildBotNameActions(botName);
                    return;
                }
            }

            if (_page == AdminPage.BotNameActions && _selectedBotName != null && tag is string botAction)
            {
                await ExecuteBotNameActionAsync(_selectedBotName, botAction).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.BotNameForm && tag is string botFormTag && botFormTag == "bots.name.submit")
            {
                await SubmitBotNameFormAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.BotSettingsForm && tag is string botSettingsTag && botSettingsTag == "bots.settings.submit")
            {
                await SubmitBotSettingsFormAsync().ConfigureAwait(true);
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
            if (_page == AdminPage.ClientUpdates && tag is string buildTag && buildTag == "clientUpdate.buildUpload")
            {
                await BuildAndUploadClientUpdateAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.ClientUpdates && tag is string updateTag && updateTag == "clientUpdate.announce")
            {
                await AnnounceClientUpdateAsync().ConfigureAwait(true);
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
        IsAdditionalPermissionsVisible = false;
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
                    var label = $"{(game.Enabled ? "Actif" : "Désactivé")} : {game.Name}";
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
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        foreach (var game in _loadedGames.OrderBy(g => g.Name))
        {
            var label = $"{(game.Enabled ? "Actif" : "Désactivé")} : {game.Name}";
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

    private Task LoadCategoriesAsync() => LoadCategoriesAsync(AdminPage.Games);

    private async Task LoadCategoriesAsync(AdminPage returnPage)
    {
        if (IsBusy) return;
        _categoriesReturnPage = returnPage;
        _page = AdminPage.GameCategories;
        Title = "Gérer les catégories";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement des catégories...";
        IsBusy = true;
        try
        {
            await RefreshCategoriesCacheAsync().ConfigureAwait(true);
            _dispatcher.Invoke(ShowCategories);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task RefreshCategoriesCacheAsync()
    {
        var payload = await _admin.ListGameCategoriesAsync().ConfigureAwait(true);
        _loadedCategories = (payload.Categories ?? new()).ToArray();
        _categoryAssignments = payload.Assignments ?? new Dictionary<string, string?>();
    }

    private async Task LoadBotsAsync()
    {
        if (IsBusy) return;
        _page = AdminPage.Bots;
        Title = "Gérer les bots";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
        IsBusy = true;
        try
        {
            var names = await _admin.ListBotNamesAsync().ConfigureAwait(true);
            var settings = await _admin.GetBotSettingsAsync().ConfigureAwait(true);
            _loadedBotNames = (names.Names ?? new()).ToArray();
            _botTurnDelayMs = settings.BotTurnDelayMs;
            _dispatcher.Invoke(ShowBots);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowBots()
    {
        _page = AdminPage.Bots;
        Title = "Gérer les bots";
        Details = "Gérer la liste de noms de bots et la vitesse des tours.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem($"Délai bot : {_botTurnDelayMs} ms", tag: "bots.settings"));
        Items.Add(new AdminMenuItem("Créer un bot", tag: "bots.create"));
        foreach (var bot in _loadedBotNames.OrderBy(b => b.Name, StringComparer.OrdinalIgnoreCase))
        {
            var status = bot.Enabled ? string.Empty : " (désactivé)";
            Items.Add(new AdminMenuItem($"{bot.Name}{status}", tag: bot));
        }
        if (_loadedBotNames.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun bot configuré."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
    }

    private void BuildBotNameActions(AdminBotNameDto bot)
    {
        _page = AdminPage.BotNameActions;
        _selectedBotName = bot;
        Title = $"Bot : {bot.Name}";
        Details = $"ID : {bot.Id}. Statut : {(bot.Enabled ? "actif" : "désactivé")}.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem(bot.Enabled ? "Désactiver" : "Activer", tag: "bots.name.toggle"));
        Items.Add(new AdminMenuItem("Renommer", tag: "bots.name.rename"));
        Items.Add(new AdminMenuItem("Supprimer", tag: "bots.name.delete"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
    }

    private void BuildBotNameForm(string mode, AdminBotNameDto? bot = null)
    {
        _page = AdminPage.BotNameForm;
        _botNameFormMode = mode;
        _botNameFormId = bot?.Id ?? 0;
        Title = mode == "create" ? "Créer un bot" : $"Renommer {bot?.Name}";
        Details = mode == "create" ? "Nom affiché dans les tables." : $"ID : {bot?.Id}";
        TextInputLabel = "Nom";
        TextInput = bot?.Name ?? string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "bots.name.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private void BuildBotSettingsForm()
    {
        _page = AdminPage.BotSettingsForm;
        Title = "Paramètres bots";
        Details = "Ajuster le délai avant qu'un bot joue son tour.";
        TextInputLabel = "Délai (ms)";
        TextInput = _botTurnDelayMs.ToString();
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "bots.settings.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitBotSettingsFormAsync()
    {
        var raw = (TextInput ?? string.Empty).Trim();
        if (!int.TryParse(raw, out var delayMs) || delayMs < 0)
        {
            await _dialogs.ShowError("Bots", "Délai invalide (ms).").ConfigureAwait(true);
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var updated = await _admin.UpdateBotSettingsAsync(delayMs).ConfigureAwait(true);
            _botTurnDelayMs = updated.BotTurnDelayMs;
            _dispatcher.Invoke(() =>
            {
                ShowBots();
                Status = "Paramètres bots enregistrés.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SubmitBotNameFormAsync()
    {
        var name = (TextInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            await _dialogs.ShowError("Bots", "Un nom est requis.").ConfigureAwait(true);
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            AdminBotNamesListResponseDto response;
            if (string.Equals(_botNameFormMode, "edit", StringComparison.OrdinalIgnoreCase) && _botNameFormId > 0)
            {
                response = await _admin.UpdateBotNameAsync(_botNameFormId, name: name).ConfigureAwait(true);
            }
            else
            {
                response = await _admin.CreateBotNameAsync(name, enabled: true).ConfigureAwait(true);
            }

            _loadedBotNames = (response.Names ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                ShowBots();
                Status = "Bot enregistré.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ExecuteBotNameActionAsync(AdminBotNameDto bot, string action)
    {
        if (IsBusy) return;

        if (action == "bots.name.rename")
        {
            BuildBotNameForm("edit", bot);
            return;
        }

        IsBusy = true;
        try
        {
            AdminBotNamesListResponseDto response;
            if (action == "bots.name.toggle")
            {
                response = await _admin.UpdateBotNameAsync(bot.Id, enabled: !bot.Enabled).ConfigureAwait(true);
            }
            else if (action == "bots.name.delete")
            {
                response = await _admin.DeleteBotNameAsync(bot.Id).ConfigureAwait(true);
            }
            else
            {
                return;
            }

            _loadedBotNames = (response.Names ?? new()).ToArray();
            _selectedBotName = null;
            _dispatcher.Invoke(() =>
            {
                ShowBots();
                Status = "Bots mis à jour.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowCategories()
    {
        _page = AdminPage.GameCategories;
        Title = "Gérer les catégories";
        Details = "Créer ou modifier les catégories disponibles.";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Créer une catégorie", tag: "games.categories.create"));
        foreach (var category in _loadedCategories.OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
        {
            var parentName = ResolveCategoryName(category.ParentId);
            var parentLabel = string.IsNullOrWhiteSpace(category.ParentId)
                ? string.Empty
                : $" (parent : {parentName ?? category.ParentId})";
            Items.Add(new AdminMenuItem($"{category.Name}{parentLabel}", tag: category));
        }
        if (_loadedCategories.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucune catégorie disponible."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : créer / modifier. Échap : retour.";
    }

    private void BuildCategoryForm(string mode, AdminGameCategoryDto? category = null)
    {
        _page = AdminPage.GameCategoryForm;
        _categoryFormMode = mode;
        _categoryFormId = category?.Id ?? string.Empty;
        Title = mode == "create" ? "Créer une catégorie" : $"Modifier la catégorie {category?.Name}";
        Details = mode == "create"
            ? "Donnez un nom et un parent (optionnel)."
            : $"ID : {category?.Id}";
        TextInputLabel = "Nom";
        TextInput = category?.Name ?? string.Empty;
        SecondaryInputLabel = "Parent (id, facultatif)";
        SecondaryInput = category?.ParentId ?? string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "game.category.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitCategoryFormAsync()
    {
        var name = (TextInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            await _dialogs.ShowError("Catégorie", "Un nom est requis.").ConfigureAwait(true);
            return;
        }

        var parentInput = (SecondaryInput ?? string.Empty).Trim();
        var parentId = string.IsNullOrEmpty(parentInput) ? null : parentInput;
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            AdminGameCategoriesResponseDto response;
            if (string.Equals(_categoryFormMode, "edit", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(_categoryFormId))
            {
                response = await _admin.UpdateGameCategoryAsync(_categoryFormId, name, parentId).ConfigureAwait(true);
            }
            else
            {
                response = await _admin.CreateGameCategoryAsync(name, parentId).ConfigureAwait(true);
            }
            _loadedCategories = (response.Categories ?? new()).ToArray();
            _categoryAssignments = response.Assignments ?? new Dictionary<string, string?>();
            _dispatcher.Invoke(() =>
            {
                ShowCategories();
                Status = "Catégorie enregistrée.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadCategoryAssignmentMenuAsync()
    {
        if (_selectedGame == null)
        {
            await _dialogs.ShowError("Catégorie", "Aucun jeu sélectionné.").ConfigureAwait(true);
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            await RefreshCategoriesCacheAsync().ConfigureAwait(true);
            _dispatcher.Invoke(ShowCategoryAssignmentList);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowCategoryAssignmentList()
    {
        if (_selectedGame == null)
        {
            ShowGames();
            return;
        }

        _page = AdminPage.GameCategoryAssign;
        Title = $"Catégorie : {_selectedGame.Name}";
        var assignedId = _categoryAssignments.TryGetValue(_selectedGame.Id, out var id) ? id : null;
        var currentName = ResolveCategoryName(assignedId);
        Details = $"Catégorie actuelle : {currentName ?? "pas de catégorie"}";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Aucune catégorie", tag: "game.category.assign.none", isCheckable: true, isChecked: assignedId == null));
        foreach (var category in _loadedCategories.OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
        {
            var isChecked = string.Equals(assignedId, category.Id, StringComparison.OrdinalIgnoreCase);
            Items.Add(new AdminMenuItem($"{category.Name}", tag: category, isCheckable: true, isChecked: isChecked));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : assigner. Échap : retour.";
    }

    private async Task AssignCategoryToGameAsync(string? categoryId)
    {
        if (_selectedGame == null)
        {
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var payload = await _admin.AssignGameCategoryAsync(_selectedGame.Id, categoryId).ConfigureAwait(true);
            _loadedCategories = (payload.Categories ?? new()).ToArray();
            _categoryAssignments = payload.Assignments ?? new Dictionary<string, string?>();
            var categoryName = ResolveCategoryName(categoryId);
            _selectedGame.CategoryId = categoryId;
            _selectedGame.Category = categoryName ?? string.Empty;
            var synced = _loadedGames.FirstOrDefault(g => string.Equals(g.Id, _selectedGame.Id, StringComparison.OrdinalIgnoreCase));
            if (synced != null)
            {
                synced.CategoryId = categoryId;
                synced.Category = _selectedGame.Category;
            }
            BuildGameActions(_selectedGame);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private string? ResolveCategoryName(string? categoryId)
    {
        if (string.IsNullOrWhiteSpace(categoryId))
        {
            return null;
        }
        return _loadedCategories.FirstOrDefault(c => string.Equals(c.Id, categoryId, StringComparison.OrdinalIgnoreCase))?.Name;
    }

    private void BuildGameActions(AdminGameDto game)
    {
        _currentEditMode = string.Empty;
        _page = AdminPage.GameActions;
        _selectedGame = game;
        Title = $"Jeu : {game.Name}";
        Details = $"Type: {game.Id}. Joueurs: {game.MinPlayers ?? 0}-{game.MaxPlayers ?? 0}. Statut: {(game.Enabled ? "actif" : "désactivé")}.";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem(game.Enabled ? "Désactiver" : "Activer", tag: "game.toggle"));
        Items.Add(new AdminMenuItem("Modifier le nom", tag: "game.edit.name"));
        Items.Add(new AdminMenuItem("Modifier la description", tag: "game.edit.description"));
        Items.Add(new AdminMenuItem("Attribuer une catégorie", tag: "game.category.assign"));
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
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = label;
        TextInput = initialValue;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        Details = $"Type: {game.Id}";
        Status = "Saisissez puis Entrée pour valider. Échap : retour.";
        _currentEditMode = mode;
    }

    private async Task SubmitGameTextEditAsync(AdminGameDto game)
    {
        var mode = _currentEditMode;
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
        IsAdditionalPermissionsVisible = false;
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
        IsAdditionalPermissionsVisible = false;
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
        IsAdditionalPermissionsVisible = false;
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
        IsAdditionalPermissionsVisible = false;
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

    private void BuildClientUpdates()
    {
        _page = AdminPage.ClientUpdates;
        Title = "Mises à jour client";
        Details = string.Empty;
        Items.Clear();
        Items.Add(new AdminMenuItem("Compiler + uploader la mise à jour (admin)", tag: "clientUpdate.buildUpload"));
        Items.Add(new AdminMenuItem("Proposer la mise à jour à tous", tag: "clientUpdate.announce"));
        SelectedItem = Items.FirstOrDefault();
        IsTextInputVisible = false;
        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        SecondaryInputLabel = "Version (nouvelle)";
        SecondaryInput = AppInfo.GetShortVersion();
        IsSecondaryInputVisible = true;
        Status = "Choisis une version plus haute que la dernière publiée. Entrée : exécuter l'action sélectionnée. Échap : retour.";

        _ = PrefillClientUpdateVersionAsync();
    }

    private async Task PrefillClientUpdateVersionAsync()
    {
        try
        {
            var latest = await _publisher.GetLatestPublishedVersionAsync().ConfigureAwait(true);
            if (string.IsNullOrWhiteSpace(latest))
            {
                return;
            }
            if (_page != AdminPage.ClientUpdates)
            {
                return;
            }

            Details = $"Dernière version publiée : {latest}";
            SecondaryInput = _publisher.SuggestNextVersion(latest);
        }
        catch
        {
            // Non bloquant.
        }
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

    private async Task AnnounceClientUpdateAsync()
    {
        var version = (SecondaryInput ?? string.Empty).Trim();
        IsBusy = true;
        try
        {
            var delivered = await _admin.AnnounceClientUpdateAsync(
                    message: null,
                    version: string.IsNullOrWhiteSpace(version) ? null : version)
                .ConfigureAwait(true);
            await _dialogs.ShowInfo("Mise à jour", $"Proposition envoyée à {delivered} utilisateur(s).").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task BuildAndUploadClientUpdateAsync()
    {
        var version = (SecondaryInput ?? string.Empty).Trim();

        var latest = await _publisher.GetLatestPublishedVersionAsync().ConfigureAwait(true);
        if (!string.IsNullOrWhiteSpace(latest) &&
            !string.IsNullOrWhiteSpace(version) &&
            string.Equals(latest, version, StringComparison.OrdinalIgnoreCase))
        {
            var suggested = _publisher.SuggestNextVersion(latest);
            SecondaryInput = suggested;
            version = suggested;
            await _dialogs.ShowInfo("Mise à jour", $"La version {latest} est déjà publiée. Version ajustée automatiquement en {suggested}.").ConfigureAwait(true);
        }

        IsBusy = true;
        try
        {
            var result = await _publisher.BuildAndUploadAsync(
                    message: null,
                    string.IsNullOrWhiteSpace(version) ? null : version)
                .ConfigureAwait(true);

            if (!result.Success)
            {
                // First-time setup: allow selecting the csproj from the admin UI.
                if (result.StatusMessage.Contains("Projet client introuvable", StringComparison.OrdinalIgnoreCase))
                {
                    var pick = await _dialogs.Confirm(
                            "Mise à jour",
                            result.StatusMessage + "\n\nSélectionner le fichier .csproj maintenant ?")
                        .ConfigureAwait(true);
                    if (pick == true)
                    {
                        var ofd = new OpenFileDialog
                        {
                            Title = "Sélectionner client-win.csproj",
                            Filter = "Projet .NET (*.csproj)|*.csproj",
                            CheckFileExists = true,
                            Multiselect = false
                        };
                        if (ofd.ShowDialog() == true)
                        {
                            var settings = UpdatePublisherLocalSettings.Load() with { ProjectPath = ofd.FileName };
                            settings.Save();
                            result = await _publisher.BuildAndUploadAsync(
                                    message: null,
                                    string.IsNullOrWhiteSpace(version) ? null : version)
                                .ConfigureAwait(true);
                            if (!result.Success)
                            {
                                await _dialogs.ShowError("Mise à jour", result.StatusMessage).ConfigureAwait(true);
                                return;
                            }
                        }
                        else
                        {
                            return;
                        }
                    }
                    else
                    {
                        return;
                    }
                }
                else
                {
                    await _dialogs.ShowError("Mise à jour", result.StatusMessage).ConfigureAwait(true);
                    return;
                }
            }

            var confirm = await _dialogs.Confirm(
                    "Mise à jour",
                    $"{result.StatusMessage}\n\nProposer la mise à jour à tous les clients maintenant ?")
                .ConfigureAwait(true);
            if (confirm == true)
            {
                await AnnounceClientUpdateAsync().ConfigureAwait(true);
            }
            else
            {
                await _dialogs.ShowInfo("Mise à jour", result.StatusMessage).ConfigureAwait(true);
            }
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadRoleDefinitionsAsync()
    {
        _page = AdminPage.RoleDefinitions;
        Title = "Gestion des rôles";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement des définitions...";
        IsBusy = true;
        try
        {
            var response = await _admin.ListRoleDefinitionsAsync().ConfigureAwait(true);
            _loadedRoleDefinitions = (response.Definitions ?? new()).ToArray();
            _dispatcher.Invoke(ShowRoleDefinitionsList);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowRoleDefinitionsList()
    {
        _page = AdminPage.RoleDefinitions;
        Title = "Gestion des rôles";
        Details = $"Définitions disponibles : {_loadedRoleDefinitions.Length}.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        _selectedRoleDefinition = null;
        Items.Clear();
        Items.Add(new AdminMenuItem("Créer un rôle", tag: "roleDefinition.create"));
        foreach (var definition in _loadedRoleDefinitions.OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase))
        {
            var label = $"{definition.Name} — {definition.Description}";
            Items.Add(new AdminMenuItem(label, tag: definition));
        }
        if (!_loadedRoleDefinitions.Any())
        {
            Items.Add(new AdminMenuItem("Aucune définition disponible."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : actions sur le rôle. Échap : retour.";
    }

    private void BuildRoleDefinitionActions(AdminRoleDefinitionDto definition)
    {
        _page = AdminPage.RoleDefinitionActions;
        _selectedRoleDefinition = definition;
        Title = $"Rôle : {definition.Name}";
        Details = definition.Description;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Modifier", tag: "roleDefinition.edit"));
        Items.Add(new AdminMenuItem("Supprimer", tag: "roleDefinition.delete"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : action. Échap : retour.";
    }

    private void BuildRoleDefinitionForm(string mode, AdminRoleDefinitionDto? definition = null)
    {
        _page = AdminPage.RoleDefinitionForm;
        _roleDefinitionFormMode = mode;
        _selectedRoleDefinition = definition;
        _roleDefinitionOriginalName = definition?.Name ?? string.Empty;
        Title = mode == "create" ? "Créer un rôle" : $"Modifier le rôle {definition?.Name}";
        Details = mode == "create"
            ? "Donnez un nom, une description et la liste des permissions."
            : definition?.Description ?? string.Empty;
        TextInputLabel = "Nom";
        TextInput = definition?.Name ?? string.Empty;
        SecondaryInputLabel = "Description";
        SecondaryInput = definition?.Description ?? string.Empty;
        AdditionalPermissionsLabel = "Permissions supplémentaires (une par ligne)";
        InitializePermissionModules(definition?.Permissions);
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = true;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "roleDefinition.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitRoleDefinitionFormAsync()
    {
        var name = (TextInput ?? string.Empty).Trim();
        var description = (SecondaryInput ?? string.Empty).Trim();
        var permissions = PermissionModules
            .SelectMany(module => module.SelectedPermissions)
            .Concat(ParsePermissions(AdditionalPermissions))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (string.IsNullOrWhiteSpace(name))
        {
            await _dialogs.ShowError("Rôle", "Un nom est requis.").ConfigureAwait(true);
            return;
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            await _dialogs.ShowError("Rôle", "Une description est requise.").ConfigureAwait(true);
            return;
        }

        if (permissions.Count == 0)
        {
            await _dialogs.ShowError("Rôle", "Liste de permissions invalide.").ConfigureAwait(true);
            return;
        }

        IsBusy = true;
        try
        {
            if (string.Equals(_roleDefinitionFormMode, "create", StringComparison.OrdinalIgnoreCase))
            {
                await _admin.CreateRoleDefinitionAsync(name, description, permissions).ConfigureAwait(true);
                await _dialogs.ShowInfo("Rôle", $"Rôle {name} créé.").ConfigureAwait(true);
            }
            else
            {
                var targetName = _roleDefinitionOriginalName;
                var newName = string.Equals(name, targetName, StringComparison.Ordinal) ? null : name;
                await _admin.UpdateRoleDefinitionAsync(targetName, newName, description, permissions).ConfigureAwait(true);
                await _dialogs.ShowInfo("Rôle", $"Rôle {targetName} mis à jour.").ConfigureAwait(true);
            }

            await LoadRoleDefinitionsAsync().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeleteRoleDefinitionAsync(AdminRoleDefinitionDto definition)
    {
        var confirmation = await _dialogs.Confirm("Suppression", $"Supprimer {definition.Name} ?").ConfigureAwait(true);
        if (confirmation != true)
        {
            return;
        }

        IsBusy = true;
        try
        {
            await _admin.DeleteRoleDefinitionAsync(definition.Name).ConfigureAwait(true);
            await LoadRoleDefinitionsAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Rôle", $"Rôle {definition.Name} supprimé.").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private static List<string> ParsePermissions(string? raw)
    {
        var separators = new[] { '\r', '\n', ',', ';' };
        return (raw ?? string.Empty)
            .Split(separators, StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim())
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private void InitializePermissionModules(IEnumerable<string>? permissions)
    {
        var remaining = new HashSet<string>(permissions ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase);
        _permissionModules.Clear();
        foreach (var descriptor in PermissionModuleDescriptors)
        {
            var state = new PermissionModuleState(descriptor);
            state.Read = remaining.Remove(state.ReadPermission);
            state.Write = remaining.Remove(state.WritePermission);
            state.Delete = remaining.Remove(state.DeletePermission);
            _permissionModules.Add(state);
        }

        var extras = remaining.OrderBy(p => p, StringComparer.OrdinalIgnoreCase).ToList();
        AdditionalPermissions = extras.Count > 0 ? string.Join(Environment.NewLine, extras) : string.Empty;
        OnPropertyChanged(nameof(PermissionModules));
    }

    public sealed class PermissionModuleState : ObservableObject
    {
        private bool _read;
        private bool _write;
        private bool _delete;

        public PermissionModuleState(PermissionModuleDescriptor descriptor)
        {
            Descriptor = descriptor;
        }

        public PermissionModuleDescriptor Descriptor { get; }

        public string DisplayName => Descriptor.DisplayName;

        public string Description => Descriptor.Description;

        public string ModuleId => Descriptor.ModuleId;

        public string ReadPermission => $"{ModuleId}.read";

        public string WritePermission => $"{ModuleId}.write";

        public string DeletePermission => $"{ModuleId}.delete";

        public string ReadLabel => $"Lecture {DisplayName}";
        public string WriteLabel => $"Écriture {DisplayName}";
        public string DeleteLabel => $"Suppression {DisplayName}";

        public bool Read
        {
            get => _read;
            set => SetProperty(ref _read, value);
        }

        public bool Write
        {
            get => _write;
            set => SetProperty(ref _write, value);
        }

        public bool Delete
        {
            get => _delete;
            set => SetProperty(ref _delete, value);
        }

        public IEnumerable<string> SelectedPermissions
        {
            get
            {
                if (Read) yield return ReadPermission;
                if (Write) yield return WritePermission;
                if (Delete) yield return DeletePermission;
            }
        }
    }

    private void ShowLogs()
    {
        _page = AdminPage.Logs;
        Title = "Logs serveurs";
        Details = "Télécharger les logs les plus récents.";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Télécharger les logs", tag: "logs.download"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : télécharger. Échap : retour.";
        UpdateFilterVisibility();
    }
}
