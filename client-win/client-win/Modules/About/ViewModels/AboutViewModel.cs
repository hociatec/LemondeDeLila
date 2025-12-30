using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Core.Constants;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;
using client_win.Modules.Updates;

namespace client_win.Modules.About.ViewModels;

public enum AboutNavResult
{
    Stay,
    Moved,
    Closed
}

public sealed class AboutViewModel : ObservableObject
{
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private readonly ClientConfiguration _config;
    private readonly IDialogService _dialogs;
    private readonly IClientUpdatePublisher _publisher;
    private AboutPage _page = AboutPage.Root;
    private string _title = "À propos";
    private string _status = "Entrée : sélectionner. Échap : retour.";
    private string _details = string.Empty;
    private bool _isBusy;
    private AboutMenuItem? _selectedItem;

    private string _appName = AppConstants.AppName;
    private string _currentVersion = AppInfo.GetShortVersion();
    private string _serverVersion = "Inconnue";
    private string _serverPublishedAt = "Inconnue";
    private string _localUpdatedAt = "Inconnue";
    private string _updateCheckStatus = "Aucune vérification en cours.";

    private readonly AsyncRelayCommand _activateCommand;
    private readonly AsyncRelayCommand _checkUpdatesCommand;

    private const string TagShortcuts = "shortcuts";
    private const string TagInfo = "info";
    private const string TagCheckUpdates = "checkUpdates";

    public AboutViewModel(
        ClientConfiguration config,
        IDialogService dialogs,
        IClientUpdatePublisher publisher,
        Action onClose)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _publisher = publisher ?? throw new ArgumentNullException(nameof(publisher));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        Items = new ObservableCollection<AboutMenuItem>();
        _activateCommand = new AsyncRelayCommand(ActivateSelectedAsync);
        _checkUpdatesCommand = new AsyncRelayCommand(CheckUpdatesAsync, () => !IsBusy);

        RefreshLocalInfo();
        BuildRoot();
    }

    public ObservableCollection<AboutMenuItem> Items { get; }

    public AboutMenuItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }

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
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                _checkUpdatesCommand.RaiseCanExecuteChanged();
                OnPropertyChanged(nameof(CanCheckUpdates));
            }
        }
    }

    public bool CanCheckUpdates => !IsBusy;

    public bool ShowItemsList => _page is AboutPage.Root or AboutPage.Info;
    public bool ShowShortcuts => _page == AboutPage.Shortcuts;
    public bool ShowInfo => _page == AboutPage.Info;

    public string AppName
    {
        get => _appName;
        private set => SetProperty(ref _appName, value);
    }

    public string CurrentVersion
    {
        get => _currentVersion;
        private set => SetProperty(ref _currentVersion, value);
    }

    public string ServerVersion
    {
        get => _serverVersion;
        private set => SetProperty(ref _serverVersion, value);
    }

    public string ServerPublishedAt
    {
        get => _serverPublishedAt;
        private set => SetProperty(ref _serverPublishedAt, value);
    }

    public string LocalUpdatedAt
    {
        get => _localUpdatedAt;
        private set => SetProperty(ref _localUpdatedAt, value);
    }

    public string UpdateCheckStatus
    {
        get => _updateCheckStatus;
        private set => SetProperty(ref _updateCheckStatus, value);
    }

    public string ShortcutsText => BuildShortcutsText();

    public AsyncRelayCommand ActivateCommand => _activateCommand;
    public AsyncRelayCommand CheckUpdatesCommand => _checkUpdatesCommand;

    public AboutNavResult HandleEscape()
    {
        if (_page is AboutPage.Shortcuts or AboutPage.Info)
        {
            BuildRoot();
            return AboutNavResult.Moved;
        }

        _close();
        return AboutNavResult.Closed;
    }

    private void BuildRoot()
    {
        _page = AboutPage.Root;
        OnPropertyChanged(nameof(ShowItemsList));
        OnPropertyChanged(nameof(ShowShortcuts));
        OnPropertyChanged(nameof(ShowInfo));

        Title = "À propos";
        Details = string.Empty;
        Items.Clear();
        Items.Add(new AboutMenuItem("Raccourcis", tag: TagShortcuts));
        Items.Add(new AboutMenuItem("Informations sur l'application", tag: TagInfo));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : ouvrir. Échap : retour.";
    }

    private void BuildShortcuts()
    {
        _page = AboutPage.Shortcuts;
        OnPropertyChanged(nameof(ShowItemsList));
        OnPropertyChanged(nameof(ShowShortcuts));
        OnPropertyChanged(nameof(ShowInfo));

        Title = "Raccourcis";
        Details = string.Empty;
        Items.Clear();
        SelectedItem = null;
        Status = "Échap : retour.";
        OnPropertyChanged(nameof(ShortcutsText));
    }

    private void BuildInfo()
    {
        _page = AboutPage.Info;
        OnPropertyChanged(nameof(ShowItemsList));
        OnPropertyChanged(nameof(ShowShortcuts));
        OnPropertyChanged(nameof(ShowInfo));

        Title = "Informations sur l'application";
        Details = string.Empty;
        Status = "Flèches : lire. Entrée : rechercher une mise à jour. Échap : retour.";

        RefreshLocalInfo();
        _ = CheckUpdatesAsync();
    }

    private async Task ActivateSelectedAsync()
    {
        if (IsBusy)
        {
            return;
        }

        var selected = SelectedItem;
        if (selected?.Tag is not string tag)
        {
            return;
        }

        if (_page == AboutPage.Root &&
            string.Equals(tag, TagShortcuts, StringComparison.OrdinalIgnoreCase))
        {
            BuildShortcuts();
            return;
        }

        if (_page == AboutPage.Root &&
            string.Equals(tag, TagInfo, StringComparison.OrdinalIgnoreCase))
        {
            BuildInfo();
            return;
        }

        if (_page == AboutPage.Info &&
            string.Equals(tag, TagCheckUpdates, StringComparison.OrdinalIgnoreCase))
        {
            await CheckUpdatesAsync().ConfigureAwait(true);
        }
    }

    private void RebuildInfoItems()
    {
        if (_page != AboutPage.Info)
        {
            return;
        }

        var previousTag = SelectedItem?.Tag;
        var previousLabel = SelectedItem?.Label;

        Items.Clear();
        Items.Add(new AboutMenuItem($"Nom : {AppName}"));
        Items.Add(new AboutMenuItem($"Version actuelle : {CurrentVersion}"));
        Items.Add(new AboutMenuItem($"Dernière mise à jour locale : {LocalUpdatedAt}"));
        Items.Add(new AboutMenuItem($"Version serveur : {ServerVersion}"));
        Items.Add(new AboutMenuItem($"Date de publication serveur : {ServerPublishedAt}"));
        Items.Add(new AboutMenuItem("Rechercher une mise à jour", tag: TagCheckUpdates));

        if (!string.IsNullOrWhiteSpace(previousTag))
        {
            SelectedItem = Items.FirstOrDefault(i =>
                string.Equals(i.Tag, previousTag, StringComparison.OrdinalIgnoreCase));
            if (SelectedItem != null)
            {
                return;
            }
        }

        if (!string.IsNullOrWhiteSpace(previousLabel))
        {
            SelectedItem = Items.FirstOrDefault(i =>
                string.Equals(i.Label, previousLabel, StringComparison.OrdinalIgnoreCase));
            if (SelectedItem != null)
            {
                return;
            }
        }

        SelectedItem = Items.FirstOrDefault();
    }

    private void RefreshLocalInfo()
    {
        try
        {
            AppName = _config.ApplicationName;
        }
        catch
        {
            AppName = AppConstants.AppName;
        }

        CurrentVersion = AppInfo.GetShortVersion();

        try
        {
            var exe = Environment.ProcessPath;
            if (!string.IsNullOrWhiteSpace(exe) && File.Exists(exe))
            {
                var dt = File.GetLastWriteTime(exe);
                LocalUpdatedAt = dt == default ? "Inconnue" : dt.ToString("dd/MM/yyyy HH:mm");
            }
            else
            {
                LocalUpdatedAt = "Inconnue";
            }
        }
        catch
        {
            LocalUpdatedAt = "Inconnue";
        }

        RebuildInfoItems();
    }

    private async Task CheckUpdatesAsync()
    {
        if (IsBusy)
        {
            return;
        }

        IsBusy = true;
        UpdateCheckStatus = "Recherche de mise à jour...";
        try
        {
            var current = AppInfo.GetShortVersion();
            var endpoint = new Uri(_config.HttpBase, $"../client/version?current={Uri.EscapeDataString(current)}");
            using var http = new HttpClient();
            var dto = await http.GetFromJsonAsync<ClientVersionDto>(endpoint, CancellationToken.None).ConfigureAwait(true);

            var serverVer = dto?.Version?.Trim();
            ServerVersion = string.IsNullOrWhiteSpace(serverVer) ? "Inconnue" : serverVer!;

            if (!string.IsNullOrWhiteSpace(dto?.PublishedAt))
            {
                if (DateTime.TryParse(dto!.PublishedAt, out var parsed))
                {
                    ServerPublishedAt = parsed.ToLocalTime().ToString("dd/MM/yyyy HH:mm");
                }
                else
                {
                    ServerPublishedAt = dto!.PublishedAt!;
                }
            }
            else
            {
                ServerPublishedAt = "Inconnue";
            }

            var isAvailable = dto?.UpdateAvailable;
            if (isAvailable == null)
            {
                // Fallback (ancien backend): comparaison côté client.
                var parsedCurrent = TryParseVersion(CurrentVersion);
                var parsedAvailable = TryParseVersion(ServerVersion);
                isAvailable = parsedCurrent != null && parsedAvailable != null && parsedAvailable > parsedCurrent;
            }

            if (isAvailable == true)
            {
                UpdateCheckStatus = $"Mise à jour disponible : {ServerVersion}. Redémarre l'application pour l'appliquer.";
            }
            else if (ServerVersion == "Inconnue")
            {
                UpdateCheckStatus = "Impossible de connaître la version serveur.";
            }
            else
            {
                UpdateCheckStatus = "Vous êtes à jour.";
            }

            RebuildInfoItems();
        }
        catch (Exception ex)
        {
            UpdateCheckStatus = $"Erreur vérification : {ex.Message}";
            await _dialogs.ShowError("Mises à jour", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private static Version? TryParseVersion(string? value)
    {
        var raw = (value ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        // Accepte "1.0.12" ou "1.0.12.0"
        var parts = raw.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length is < 1 or > 4)
        {
            return null;
        }

        int[] nums = new int[4];
        for (int i = 0; i < parts.Length; i++)
        {
            if (!int.TryParse(parts[i], out var n) || n < 0)
            {
                return null;
            }
            nums[i] = n;
        }

        return new Version(nums[0], nums[1], nums[2], nums[3]);
    }

    private string BuildShortcutsText()
    {
        var sb = new StringBuilder();
        sb.AppendLine("Général");
        sb.AppendLine("- Flèches : naviguer");
        sb.AppendLine("- Entrée : valider / sélectionner");
        sb.AppendLine("- Échap : retour / fermer");
        sb.AppendLine();
        sb.AppendLine("Table (salle)");
        sb.AppendLine("- Tab : basculer Zone de jeu → Historique");
        sb.AppendLine("- Maj+Tab : basculer Historique → Zone de jeu");
        sb.AppendLine("- i : informations table");
        sb.AppendLine("- w : lister les joueurs");
        sb.AppendLine("- q : quitter la table");
        sb.AppendLine("- b : ajouter un bot (hors partie)");
        sb.AppendLine("- Maj+B : retirer un bot (hors partie)");
        sb.AppendLine("- Ctrl+M : mode joueur/spectateur");
        sb.AppendLine("- Ctrl+H : visiblité de la table");
        sb.AppendLine();
        sb.AppendLine("Objets / interface (en partie, selon le jeu)");
        sb.AppendLine("- Espace : piocher");
        sb.AppendLine("- Retour arrière : défausser (choisir une carte)");
        sb.AppendLine("- s : score ou shopping list (Panier Express)");
        sb.AppendLine("- b : annoncer panier");
        sb.AppendLine("- i : annoncer inventaire");
        sb.AppendLine("- c : annoncer main");
        sb.AppendLine("- f : annoncer familles complètes");
        sb.AppendLine("- p : position plateau");
        sb.AppendLine();
        sb.AppendLine("Chat");
        sb.AppendLine("- Entrée : envoyer le message");
        sb.AppendLine("- Échap : fermer le chat");
        return sb.ToString();
    }

    private enum AboutPage
    {
        Root,
        Shortcuts,
        Info
    }

    private sealed class ClientVersionDto
    {
        [JsonPropertyName("version")]
        public string? Version { get; set; }

        [JsonPropertyName("publishedAt")]
        public string? PublishedAt { get; set; }

        [JsonPropertyName("updateAvailable")]
        public bool? UpdateAvailable { get; set; }
    }
}
