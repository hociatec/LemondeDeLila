using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Data;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Admin.Dtos;
using client_win.Modules.Admin.Services;
using client_win.Modules.Audio.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;
using client_win.Modules.Updates;
using client_win.Modules.User.Services;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Network.Services;
using client_win.Modules.TextPrompts.Services;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel : ObservableObject
{
    private readonly IAdminService _admin;
    private readonly IAdminMaintenanceHttpService _maintenance;
    private readonly IAdminMaintenanceTokenStore _maintenanceTokenStore;
    private readonly ISecretPromptService _secretPrompts;
    private readonly IDialogService _dialogs;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private readonly ClientConfiguration _config;
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
    private AdminMnemoQuizCategoryDto[] _mnemoQuizCategories = Array.Empty<AdminMnemoQuizCategoryDto>();
    private AdminMnemoQuizCategoryDto? _selectedMnemoQuizCategory;
    private AdminMnemoQuizQuestionDto[] _mnemoQuizQuestions = Array.Empty<AdminMnemoQuizQuestionDto>();
    private AdminMnemoQuizQuestionDto? _selectedMnemoQuizQuestion;
    private AdminBotNameDto[] _loadedBotNames = Array.Empty<AdminBotNameDto>();
    private AdminBotNameDto? _selectedBotName;
    private int _botTurnDelayMs = 4000;
    private string _botNameFormMode = string.Empty;
    private int _botNameFormId;
    private string _botNameFormOriginalName = string.Empty;
    private AdminRoleDefinitionDto[] _loadedRoleDefinitions = Array.Empty<AdminRoleDefinitionDto>();
    private AdminRoleDefinitionDto? _selectedRoleDefinition;
    private string _roleDefinitionFormMode = string.Empty;
    private string _roleDefinitionOriginalName = string.Empty;
    private string _currentEditMode = string.Empty;
    private AdminChatMessageDto[] _loadedChatMessages = Array.Empty<AdminChatMessageDto>();
    private AdminChatMessageDto? _selectedChatMessage;
    private DateTime? _selectedChatDay;
    private AdminPage _chatReturnPage = AdminPage.Chat;
    private string _chatBanReason = string.Empty;
    private string _chatBanDays = "30";

    private string _primaryInputLabel = string.Empty;
    private string _primaryInput = string.Empty;
    private string _secondaryInputLabel = string.Empty;
    private string _secondaryInput = string.Empty;
    private string _thirdInputLabel = string.Empty;
    private string _thirdInput = string.Empty;
    private string _fourthInputLabel = string.Empty;
    private string _fourthInput = string.Empty;
    private string _fifthInputLabel = string.Empty;
    private string _fifthInput = string.Empty;
    private bool _primaryInputAcceptsReturn = true;
    private bool _secondaryInputAcceptsReturn;
    private bool _isPrimaryInputVisible;
    private bool _isSecondaryInputVisible;
    private bool _isThirdInputVisible;
    private bool _isFourthInputVisible;
    private bool _isFifthInputVisible;
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
        new("admin.stats", "Livre des contes", "Consulter le livre des contes"),
        new("admin.chat", "Tchat", "Gérer et surveiller la messagerie"),
        new("game", "Parties", "Actions génériques sur les parties")
    };
    private readonly List<PermissionModuleState> _permissionModules = PermissionModuleDescriptors.Select(d => new PermissionModuleState(d)).ToList();
    private string _additionalPermissionsLabel = string.Empty;
    private string _additionalPermissions = string.Empty;
    private bool _isAdditionalPermissionsVisible;
    private int _logLines = 200;
    private string _logFilter = string.Empty;
    private readonly IClientUpdatePublisher _publisher;
    private readonly IOptionsService _options;
    private readonly ISoundService _sounds;
    private readonly ISessionService _session;
    private readonly IRemoteSoundCache _remoteSounds;
    private readonly IGameTableOpener _tables;
    private readonly IRoomDirectoryClient _roomDirectory;
    private readonly IApiCapabilitiesService _apiCapabilities;
    private readonly Func<object?> _returnContent;
    private readonly Func<Task<string>>? _openNotifications;
    private readonly Func<int, string, Task<string>>? _openStoryBookForUser;
    private string? _userPickMode;

    public AdminViewModel(
        IAdminService admin,
        IAdminMaintenanceHttpService maintenance,
        IAdminMaintenanceTokenStore maintenanceTokenStore,
        ISecretPromptService secretPrompts,
        IRoomDirectoryClient roomDirectory,
        IApiCapabilitiesService apiCapabilities,
        ClientConfiguration config,
        IClientUpdatePublisher publisher,
        IDialogService dialogs,
        IOptionsService options,
        ISoundService sounds,
        ISessionService session,
        IRemoteSoundCache remoteSounds,
        IGameTableOpener tables,
        Func<object?> returnContent,
        Func<Task<string>>? openNotifications,
        Func<int, string, Task<string>>? openStoryBookForUser,
        Action onClose)
    {
        _admin = admin ?? throw new ArgumentNullException(nameof(admin));
        _maintenance = maintenance ?? throw new ArgumentNullException(nameof(maintenance));
        _maintenanceTokenStore = maintenanceTokenStore ?? throw new ArgumentNullException(nameof(maintenanceTokenStore));
        _secretPrompts = secretPrompts ?? throw new ArgumentNullException(nameof(secretPrompts));
        _roomDirectory = roomDirectory ?? throw new ArgumentNullException(nameof(roomDirectory));
        _apiCapabilities = apiCapabilities ?? throw new ArgumentNullException(nameof(apiCapabilities));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _publisher = publisher ?? throw new ArgumentNullException(nameof(publisher));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _remoteSounds = remoteSounds ?? throw new ArgumentNullException(nameof(remoteSounds));
        _tables = tables ?? throw new ArgumentNullException(nameof(tables));
        _returnContent = returnContent ?? throw new ArgumentNullException(nameof(returnContent));
        _openNotifications = openNotifications;
        _openStoryBookForUser = openStoryBookForUser;
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        Items = new ObservableCollection<AdminMenuItem>();
        ItemsView = CollectionViewSource.GetDefaultView(Items);
        ActivateCommand = new AsyncRelayCommand(ActivateSelectedAsync);
        ApplyFiltersCommand = new AsyncRelayCommand(ApplyFiltersAsync);
        DownloadLogsCommand = new AsyncRelayCommand(DownloadLogsAsync);
        EscapeCommand = new RelayCommand(() =>
        {
            var result = HandleEscape();
            if (result != AdminNavResult.Closed)
            {
                NavigationChanged?.Invoke();
            }
        });
        SelectAndActivateCommand = new AsyncRelayCommand<AdminMenuItem>(async item =>
        {
            if (item == null)
            {
                return;
            }

            SelectedItem = item;
            await ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
        });

        BuildRoot();
    }

    public event Action? NavigationChanged;

    public bool IsRootMenu => _page == AdminPage.Root;

    public ObservableCollection<AdminMenuItem> Items { get; }
    public ICollectionView ItemsView { get; }

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

    public bool PreferDetailsFocus
    {
        get => _preferDetailsFocus;
        private set => SetProperty(ref _preferDetailsFocus, value);
    }
    private bool _preferDetailsFocus;

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

    public string ThirdInputLabel
    {
        get => _thirdInputLabel;
        private set => SetProperty(ref _thirdInputLabel, value);
    }

    public string ThirdInput
    {
        get => _thirdInput;
        set => SetProperty(ref _thirdInput, value);
    }

    public string FourthInputLabel
    {
        get => _fourthInputLabel;
        private set => SetProperty(ref _fourthInputLabel, value);
    }

    public string FourthInput
    {
        get => _fourthInput;
        set => SetProperty(ref _fourthInput, value);
    }

    public string FifthInputLabel
    {
        get => _fifthInputLabel;
        private set => SetProperty(ref _fifthInputLabel, value);
    }

    public string FifthInput
    {
        get => _fifthInput;
        set => SetProperty(ref _fifthInput, value);
    }

    public bool PrimaryInputAcceptsReturn
    {
        get => _primaryInputAcceptsReturn;
        set => SetProperty(ref _primaryInputAcceptsReturn, value);
    }

    public bool SecondaryInputAcceptsReturn
    {
        get => _secondaryInputAcceptsReturn;
        set => SetProperty(ref _secondaryInputAcceptsReturn, value);
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

    public bool IsThirdInputVisible
    {
        get => _isThirdInputVisible;
        private set => SetProperty(ref _isThirdInputVisible, value);
    }

    public bool IsFourthInputVisible
    {
        get => _isFourthInputVisible;
        private set => SetProperty(ref _isFourthInputVisible, value);
    }

    public bool IsFifthInputVisible
    {
        get => _isFifthInputVisible;
        private set => SetProperty(ref _isFifthInputVisible, value);
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
    public RelayCommand EscapeCommand { get; }
    public AsyncRelayCommand<AdminMenuItem> SelectAndActivateCommand { get; }
}
