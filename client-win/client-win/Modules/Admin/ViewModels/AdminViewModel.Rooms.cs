using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;
using client_win.Modules.Game.RoomDirectory.Services;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminRoomMaintenanceSettingsDto? _roomSettings;
    private PublicRoomListItem[] _publicJoinableRooms = Array.Empty<PublicRoomListItem>();

    private void BuildRooms()
    {
        _page = AdminPage.Rooms;
        Title = "Gérer les rooms";
        Details = _roomSettings == null
            ? "Outils de maintenance pour les rooms (tables)."
            : $"Auto-cleanup: {_roomSettings}";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Nettoyer les rooms (supprime les tables publiques non démarrées)", tag: "rooms.cleanup.public"));
        Items.Add(new AdminMenuItem("Intégrer une room (liste des tables publiques, silencieux)", tag: "rooms.join.silent"));
        Items.Add(new AdminMenuItem("Détruire une room (force, liste des tables publiques)", tag: "rooms.destroy"));
        Items.Add(new AdminMenuItem("Rafraîchir paramètres (relit la configuration côté serveur)", tag: "rooms.settings.refresh"));
        Items.Add(new AdminMenuItem("Auto-cleanup: activer/désactiver (nettoyage automatique)", tag: "rooms.settings.toggle"));
        Items.Add(new AdminMenuItem("Auto-cleanup: régler âge max (minutes) (supprime au-delà de cet âge)", tag: "rooms.settings.olderThan"));
        Items.Add(new AdminMenuItem("Auto-cleanup: régler interval (secondes) (fréquence du nettoyage)", tag: "rooms.settings.interval"));
        Items.Add(new AdminMenuItem("Auto-cleanup: régler limite (max rooms) (limite de rooms conservées)", tag: "rooms.settings.limit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildRoomsJoinSilent()
    {
        _page = AdminPage.RoomsJoinSilent;
        Title = "Intégrer une room";
        Items.Clear();

        var listed = _publicJoinableRooms ?? Array.Empty<PublicRoomListItem>();
        if (listed.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucune table publique disponible", tag: null));
            SelectedItem = Items.FirstOrDefault();
            Details = "Aucune table publique à intégrer.";
            Status = "Échap : retour.";
        }
        else
        {
            foreach (var room in listed.OrderByDescending(r => r.Id))
            {
                Items.Add(new AdminMenuItem(room.ToString(), tag: $"rooms.join.silent.open:{room.Id}"));
            }

            SelectedItem = Items.FirstOrDefault(i => i.Tag is string s && s.StartsWith("rooms.join.silent.open:", StringComparison.OrdinalIgnoreCase))
                          ?? Items.FirstOrDefault();
            Details = "Sélectionnez une table publique à intégrer en mode silencieux (spectateur).";
            Status = "Entrée : intégrer la table sélectionnée. Échap : retour.";
        }

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task RefreshRoomsJoinSilentListAsync()
    {
        if (IsBusy)
        {
            return;
        }

        try
        {
            IsBusy = true;
            _publicJoinableRooms = (await _roomDirectory.PublicListAsync().ConfigureAwait(true)).Items;
            BuildRoomsJoinSilent();
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

    private async Task OpenRoomsJoinSilentAsync()
    {
        PushReturnFocus();
        await RefreshRoomsJoinSilentListAsync().ConfigureAwait(true);
    }

    private void BuildRoomsDestroy()
    {
        _page = AdminPage.RoomsDestroy;
        Title = "Détruire une room";
        Items.Clear();

        var listed = _publicJoinableRooms ?? Array.Empty<PublicRoomListItem>();
        if (listed.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucune table publique disponible", tag: null));
            SelectedItem = Items.FirstOrDefault();
            Details = "Aucune table publique à détruire.";
            Status = "Échap : retour.";
        }
        else
        {
            foreach (var room in listed.OrderByDescending(r => r.Id))
            {
                Items.Add(new AdminMenuItem(room.ToString(), tag: $"rooms.destroy.open:{room.Id}"));
            }

            SelectedItem = Items.FirstOrDefault();
            Details = "Détruit la table sélectionnée (même si des joueurs sont dessus).";
            Status = "Entrée : détruire la table sélectionnée. Échap : retour.";
        }

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task OpenRoomsDestroyAsync()
    {
        PushReturnFocus();
        await RefreshRoomsJoinSilentListAsync().ConfigureAwait(true);
        BuildRoomsDestroy();
    }

    private async Task DestroyRoomAsync(int roomId)
    {
        if (roomId <= 0 || IsBusy)
        {
            return;
        }

        var ok = await _dialogs.Confirm(
            "Détruire la room",
            $"Détruire la table #{roomId} ?\n\nAttention : si des joueurs sont sur la table, ils seront renvoyés à l'accueil et la table sera supprimée.",
            okText: "Détruire",
            cancelText: "Annuler").ConfigureAwait(true);

        if (ok != true)
        {
            return;
        }

        try
        {
            IsBusy = true;
            var res = await _admin.DestroyRoomAsync(roomId).ConfigureAwait(true);
            await _dialogs.ShowInfo("Rooms", $"Room #{res.RoomId} détruite.").ConfigureAwait(true);
            _publicJoinableRooms = (await _roomDirectory.PublicListAsync().ConfigureAwait(true)).Items;
            BuildRoomsDestroy();
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

    private async Task JoinSilentOpenSelectedAsync(int roomId)
    {
        if (roomId <= 0)
        {
            return;
        }

        if (IsBusy)
        {
            return;
        }

        try
        {
            IsBusy = true;
            await _tables.OpenExistingAsync(roomId, _returnView, spectator: true, silent: true).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
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
