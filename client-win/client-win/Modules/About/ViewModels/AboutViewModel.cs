using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Core.Constants;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;
using client_win.Modules.Network.Services;

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
    private readonly INotifyGatewayClient _notify;
    private AboutPage _page = AboutPage.Root;
    private string _title = "À propos";
    private string _status = "Entrée : sélectionner. Échap : retour.";
    private string _details = string.Empty;
    private bool _isBusy;
    private AboutMenuItem? _selectedItem;
    private string _contactMessage = string.Empty;

    private string _appName = AppConstants.AppName;
    private string _currentVersion = AppInfo.GetShortVersion();
    private string _localUpdatedAt = "Inconnue";

    private readonly AsyncRelayCommand _activateCommand;
    private readonly AsyncRelayCommand _sendContactCommand;
    private readonly RelayCommand _cancelContactCommand;

    private const string TagShortcuts = "shortcuts";
    private const string TagInfo = "info";
    private const string TagContactAdmin = "contact_admin";

    public AboutViewModel(
        ClientConfiguration config,
        IDialogService dialogs,
        INotifyGatewayClient notify,
        Action onClose,
        bool openContactAdmin = false)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _notify = notify ?? throw new ArgumentNullException(nameof(notify));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        Items = new ObservableCollection<AboutMenuItem>();
        _activateCommand = new AsyncRelayCommand(ActivateSelectedAsync);
        _sendContactCommand = new AsyncRelayCommand(SendContactAsync);
        _cancelContactCommand = new RelayCommand(() => BuildRoot());

        RefreshLocalInfo();
        BuildRoot();
        if (openContactAdmin)
        {
            BuildContactAdmin();
        }
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
            }
        }
    }

    public bool ShowItemsList => _page is AboutPage.Root or AboutPage.Info;
    public bool ShowShortcuts => _page == AboutPage.Shortcuts;
    public bool ShowInfo => _page == AboutPage.Info;
    public bool ShowContactAdmin => _page == AboutPage.ContactAdmin;

    public string ContactMessage
    {
        get => _contactMessage;
        set => SetProperty(ref _contactMessage, value);
    }

    public AsyncRelayCommand SendContactCommand => _sendContactCommand;
    public RelayCommand CancelContactCommand => _cancelContactCommand;

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

    public string LocalUpdatedAt
    {
        get => _localUpdatedAt;
        private set => SetProperty(ref _localUpdatedAt, value);
    }

    public string ShortcutsText => BuildShortcutsText();

    public AsyncRelayCommand ActivateCommand => _activateCommand;

    public AboutNavResult HandleEscape()
    {
        if (_page is AboutPage.Shortcuts or AboutPage.Info or AboutPage.ContactAdmin)
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
        OnPropertyChanged(nameof(ShowContactAdmin));

        Title = "À propos";
        Details = string.Empty;
        Items.Clear();
        Items.Add(new AboutMenuItem("Raccourcis", tag: TagShortcuts));
        Items.Add(new AboutMenuItem("Informations sur l'application", tag: TagInfo));
        Items.Add(new AboutMenuItem("Contacter un administrateur", tag: TagContactAdmin));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : ouvrir. Échap : retour.";
    }

    private void BuildShortcuts()
    {
        _page = AboutPage.Shortcuts;
        OnPropertyChanged(nameof(ShowItemsList));
        OnPropertyChanged(nameof(ShowShortcuts));
        OnPropertyChanged(nameof(ShowInfo));
        OnPropertyChanged(nameof(ShowContactAdmin));

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
        OnPropertyChanged(nameof(ShowContactAdmin));

        Title = "Informations sur l'application";
        Details = string.Empty;
        Status = "Flèches : lire. Échap : retour.";

        RefreshLocalInfo();
    }

    private void BuildContactAdmin()
    {
        _page = AboutPage.ContactAdmin;
        OnPropertyChanged(nameof(ShowItemsList));
        OnPropertyChanged(nameof(ShowShortcuts));
        OnPropertyChanged(nameof(ShowInfo));
        OnPropertyChanged(nameof(ShowContactAdmin));

        Title = "Contacter un administrateur";
        Details = string.Empty;
        Items.Clear();
        SelectedItem = null;
        Status = "Tab : naviguer. Entrée : envoyer. Échap : retour.";
        ContactMessage = string.Empty;
    }

    private Task ActivateSelectedAsync()
    {
        if (IsBusy)
        {
            return Task.CompletedTask;
        }

        var selected = SelectedItem;
        if (selected?.Tag is not string tag)
        {
            return Task.CompletedTask;
        }

        if (_page == AboutPage.Root &&
            string.Equals(tag, TagShortcuts, StringComparison.OrdinalIgnoreCase))
        {
            BuildShortcuts();
            return Task.CompletedTask;
        }

        if (_page == AboutPage.Root &&
            string.Equals(tag, TagInfo, StringComparison.OrdinalIgnoreCase))
        {
            BuildInfo();
            return Task.CompletedTask;
        }

        if (_page == AboutPage.Root &&
            string.Equals(tag, TagContactAdmin, StringComparison.OrdinalIgnoreCase))
        {
            BuildContactAdmin();
            return Task.CompletedTask;
        }

        return Task.CompletedTask;
    }

    private async Task SendContactAsync()
    {
        if (IsBusy)
        {
            return;
        }

        var message = (ContactMessage ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(message))
        {
            Status = "Message vide.";
            return;
        }

        IsBusy = true;
        try
        {
            await _notify.SendAsync("notify.admin_contact.send", new { message }).ConfigureAwait(true);
            BuildRoot();
            Status = "Message envoyé au staff.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur : {ex.Message}";
            await _dialogs.ShowError("Contact admin", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void RebuildInfoItems()
    {
        if (_page != AboutPage.Info)
        {
            return;
        }

        var previousTag = SelectedItem?.Tag as string;
        var previousLabel = SelectedItem?.Label;

        Items.Clear();
        Items.Add(new AboutMenuItem($"Nom : {AppName}"));
        Items.Add(new AboutMenuItem($"Version actuelle : {CurrentVersion}"));
        Items.Add(new AboutMenuItem($"Dernière mise à jour locale : {LocalUpdatedAt}"));

        if (!string.IsNullOrWhiteSpace(previousTag))
        {
            SelectedItem = Items.FirstOrDefault(i =>
                i.Tag is string tag &&
                string.Equals(tag, previousTag, StringComparison.OrdinalIgnoreCase));
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

    private string BuildShortcutsText()
    {
        var sb = new StringBuilder();
        sb.AppendLine("Général");
        sb.AppendLine("- Flèches : naviguer");
        sb.AppendLine("- Entrée : valider / sélectionner");
        sb.AppendLine("- Échap : retour / fermer");
        sb.AppendLine("- Ctrl+U : présence (joueurs connectés)");
        sb.AppendLine("- F3 : contacter un administrateur");
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
        sb.AppendLine("Tchat");
        sb.AppendLine("- Entrée : envoyer le message");
        sb.AppendLine("- Échap : fermer le tchat");
        return sb.ToString();
    }

    private enum AboutPage
    {
        Root,
        Shortcuts,
        Info,
        ContactAdmin
    }
}
