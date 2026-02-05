using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Vault.Models;
using client_win.Modules.Vault.Services;

namespace client_win.Modules.Vault.ViewModels;

public sealed class VaultViewModel : ObservableObject, IDisposable
{
    private readonly IVaultClient _vault;
    private readonly IGameTableOpener _tables;
    private readonly IDialogService _dialogs;
    private readonly IAnnouncementService _announcements;
    private readonly Action _close;
    private readonly object _returnContent;
    private bool _isBusy;
    private bool _initialized;
    private string _status = "Chargement du coffre fort…";
    private VaultSnapshotItem? _selected;

    public VaultViewModel(
        IVaultClient vault,
        IGameTableOpener tables,
        IDialogService dialogs,
        IAnnouncementService announcements,
        object returnContent,
        Action onClose)
    {
        _vault = vault ?? throw new ArgumentNullException(nameof(vault));
        _tables = tables ?? throw new ArgumentNullException(nameof(tables));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        _returnContent = returnContent ?? throw new ArgumentNullException(nameof(returnContent));
        _close = onClose ?? (() => { });

        RefreshCommand = new AsyncRelayCommand(LoadAsync, () => !IsBusy);
        RestoreCommand = new AsyncRelayCommand(RestoreAsync, () => !IsBusy && Selected != null);
        DeleteCommand = new AsyncRelayCommand(DeleteAsync, () => !IsBusy && Selected != null);
        CloseCommand = new RelayCommand(_close);

    }

    // Called by the view once it is visible: ensures we don't trigger network calls before the UI is shown.
    public Task InitializeAsync()
    {
        if (_initialized)
        {
            return Task.CompletedTask;
        }

        _initialized = true;
        return LoadAsync();
    }

    public ObservableCollection<VaultSnapshotItem> Items { get; } = new();

    public VaultSnapshotItem? Selected
    {
        get => _selected;
        set
        {
            if (SetProperty(ref _selected, value))
            {
                (RestoreCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
                (DeleteCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
            }
        }
    }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                (RefreshCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
                (RestoreCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
                (DeleteCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
            }
        }
    }

    public ICommand RefreshCommand { get; }
    public ICommand RestoreCommand { get; }
    public ICommand DeleteCommand { get; }
    public ICommand CloseCommand { get; }

    public void Dispose()
    {
    }

    public async Task LoadAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            Status = "Chargement du coffre fort…";
            var items = await _vault.ListAsync().ConfigureAwait(true);
            Items.Clear();
            foreach (var it in items)
            {
                Items.Add(it);
            }
            Selected = Items.FirstOrDefault();
            Status = Items.Count == 0
                ? "Coffre fort vide."
                : "Entrée : restaurer. Suppr : supprimer. Échap : fermer.";
        }
        catch (Exception ex)
        {
            Status = "Coffre fort indisponible.";
            await _dialogs.ShowError("Mon coffre fort", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task RestoreAsync()
    {
        var selected = Selected;
        if (selected == null || IsBusy) return;
        IsBusy = true;
        try
        {
            Status = "Restauration…";
            var roomId = await _vault.RestoreAsync(selected.Id).ConfigureAwait(true);
            _announcements.Enqueue("Partie restaurée. Ouverture de la table…", AnnouncementPriority.Polite);
            await _tables.OpenExistingAsync(roomId, _returnContent, spectator: false, silent: false, vaultSnapshotId: selected.Id)
                .ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Mon coffre fort", ex.Message).ConfigureAwait(true);
            Status = "Restauration échouée.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeleteAsync()
    {
        var selected = Selected;
        if (selected == null || IsBusy) return;
        IsBusy = true;
        try
        {
            var confirm = await _dialogs.Confirm(
                    "Mon coffre fort",
                    $"Supprimer la sauvegarde \"{selected.Name}\" ?")
                .ConfigureAwait(true);
            if (confirm != true)
            {
                Status = "Suppression annulée.";
                return;
            }

            var ok = await _vault.DeleteAsync(selected.Id).ConfigureAwait(true);
            if (!ok)
            {
                Status = "Suppression impossible.";
                return;
            }
            _announcements.Enqueue("Sauvegarde supprimée.", AnnouncementPriority.Polite);
            await LoadAsync().ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Mon coffre fort", ex.Message).ConfigureAwait(true);
            Status = "Suppression échouée.";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
