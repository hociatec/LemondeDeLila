using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminRoomMaintenanceSettingsDto? _roomSettings;

    private void BuildRooms()
    {
        _page = AdminPage.Rooms;
        Title = "Rooms / tables";
        Details = _roomSettings == null
            ? "Outils de maintenance pour les tables (rooms)."
            : $"Auto-cleanup: {_roomSettings}";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Nettoyer les rooms (tables publiques ouvertes)", tag: "rooms.cleanup.public"));
        Items.Add(new AdminMenuItem("Rafraîchir paramètres", tag: "rooms.settings.refresh"));
        Items.Add(new AdminMenuItem("Auto-cleanup: activer/désactiver", tag: "rooms.settings.toggle"));
        Items.Add(new AdminMenuItem("Auto-cleanup: régler âge max (minutes)", tag: "rooms.settings.olderThan"));
        Items.Add(new AdminMenuItem("Auto-cleanup: régler interval (secondes)", tag: "rooms.settings.interval"));
        Items.Add(new AdminMenuItem("Auto-cleanup: régler limite (max rooms)", tag: "rooms.settings.limit"));
        Items.Add(new AdminMenuItem("Retour", tag: "back"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task RefreshRoomSettingsAsync()
    {
        try
        {
            IsBusy = true;
            _roomSettings = await _admin.GetRoomMaintenanceSettingsAsync().ConfigureAwait(true);
            BuildRooms();
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rooms", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ToggleAutoCleanupAsync()
    {
        try
        {
            IsBusy = true;
            var current = _roomSettings ?? await _admin.GetRoomMaintenanceSettingsAsync().ConfigureAwait(true);
            var next = await _admin.UpdateRoomMaintenanceSettingsAsync(autoCleanupEnabled: !current.AutoCleanupEnabled).ConfigureAwait(true);
            _roomSettings = next;
            BuildRooms();
            await _dialogs.ShowInfo("Rooms", $"Auto-cleanup {(next.AutoCleanupEnabled ? "activé" : "désactivé")}.").ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rooms", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildRoomsSettingEdit(string title, string label, string initialValue, string mode)
    {
        _page = AdminPage.EditText;
        Title = title;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "rooms.settings.submit"));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = label;
        TextInput = initialValue;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        Details = _roomSettings == null ? string.Empty : $"Auto-cleanup: {_roomSettings}";
        Status = "Saisissez puis Entrée pour valider. Échap : retour.";
        _currentEditMode = mode;
    }

    private async Task SubmitRoomsSettingEditAsync()
    {
        var mode = _currentEditMode ?? string.Empty;
        var value = (TextInput ?? string.Empty).Trim();
        if (!int.TryParse(value, out var num))
        {
            await _dialogs.ShowError("Rooms", "Valeur invalide.").ConfigureAwait(true);
            return;
        }

        try
        {
            IsBusy = true;
            AdminRoomMaintenanceSettingsDto updated;
            if (mode == "rooms.settings.olderThan")
            {
                updated = await _admin.UpdateRoomMaintenanceSettingsAsync(autoCleanupOlderThanMinutes: num).ConfigureAwait(true);
            }
            else if (mode == "rooms.settings.interval")
            {
                updated = await _admin.UpdateRoomMaintenanceSettingsAsync(autoCleanupIntervalSeconds: num).ConfigureAwait(true);
            }
            else if (mode == "rooms.settings.limit")
            {
                updated = await _admin.UpdateRoomMaintenanceSettingsAsync(autoCleanupLimit: num).ConfigureAwait(true);
            }
            else
            {
                return;
            }

            _roomSettings = updated;
            BuildRooms();
            await _dialogs.ShowInfo("Rooms", $"Paramètres mis à jour: {updated}").ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rooms", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task CleanupPublicRoomsAsync()
    {
        var confirm = await _dialogs.Confirm(
            "Nettoyer les rooms",
            "Supprimer toutes les tables publiques non démarrées.\n\nAttention : si une table est réellement utilisée, elle sera supprimée.",
            okText: "Nettoyer",
            cancelText: "Annuler").ConfigureAwait(true);

        if (confirm != true)
        {
            return;
        }

        try
        {
            IsBusy = true;
            var res = await _admin.CleanupRoomsAsync(includePrivate: false, includeStarted: false, olderThanMinutes: null)
                .ConfigureAwait(true);
            await _dialogs.ShowInfo("Rooms", $"Nettoyage terminé. Supprimées: {res.Deleted}").ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rooms", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
