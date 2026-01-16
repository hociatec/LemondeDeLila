using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;
using client_win.Modules.Game.RoomDirectory.Services;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminRoomMaintenanceSettingsDto? _roomSettings;
    private AdminRoomListItemDto[] _roomsForAdmin = Array.Empty<AdminRoomListItemDto>();

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
        Items.Add(new AdminMenuItem("Intégrer une room (liste des tables, public/privé, silencieux)", tag: "rooms.join.silent"));
        Items.Add(new AdminMenuItem("Détruire une room (force, public/privé)", tag: "rooms.destroy"));
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

        var listed = _roomsForAdmin ?? Array.Empty<AdminRoomListItemDto>();
        if (listed.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucune table disponible", tag: null));
            SelectedItem = Items.FirstOrDefault();
            Details = "Aucune table à intégrer.";
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
            Details = "Sélectionnez une table (publique/privée) à intégrer en mode silencieux (admin invisible, non listé).";
            Status = "Entrée : intégrer la table sélectionnée. Échap : retour.";
        }

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task RefreshAdminRoomsListAsync()
    {
        if (IsBusy)
        {
            return;
        }

        try
        {
            IsBusy = true;
            var caps = await _apiCapabilities.GetAsync().ConfigureAwait(true);
            if (!caps.SupportsAdminRoomsList)
            {
                // Compat / feature gating: éviter d'envoyer un message WS non supporté.
                var fallback = await _roomDirectory.PublicListAsync().ConfigureAwait(true);
                _roomsForAdmin = (fallback.Items ?? Array.Empty<PublicRoomListItem>())
                    .Select(r => new AdminRoomListItemDto
                    {
                        Id = r.Id,
                        Name = r.Name,
                        GameType = r.GameType,
                        Status = r.Status,
                        IsPrivate = false,
                        MaxPlayers = r.MaxPlayers,
                        PlayersCount = r.PlayersCount,
                        BotsCount = r.BotsCount,
                        OwnerUsername = r.OwnerUsername,
                        ActivePlayers = 0
                    })
                    .ToArray();
                return;
            }

            var listed = await _admin.ListRoomsAsync(includePrivate: true, includeStarted: true).ConfigureAwait(true);
            _roomsForAdmin = listed.Items ?? Array.Empty<AdminRoomListItemDto>();
        }
        catch (Exception ex)
        {
            var msg = (ex.Message ?? string.Empty).Trim();
            if (msg.Contains("Type de message inconnu", StringComparison.OrdinalIgnoreCase) ||
                msg.Contains("message inconnu", StringComparison.OrdinalIgnoreCase) ||
                msg.Contains("admin.rooms.list", StringComparison.OrdinalIgnoreCase))
            {
                // Compat: si le serveur n'est pas encore à jour, on retombe sur la liste publique.
                // (Les tables privées ne sont pas accessibles sans support serveur.)
                try
                {
                    var fallback = await _roomDirectory.PublicListAsync().ConfigureAwait(true);
                    _roomsForAdmin = (fallback.Items ?? Array.Empty<PublicRoomListItem>())
                        .Select(r => new AdminRoomListItemDto
                        {
                            Id = r.Id,
                            Name = r.Name,
                            GameType = r.GameType,
                            Status = r.Status,
                            IsPrivate = false,
                            MaxPlayers = r.MaxPlayers,
                            PlayersCount = r.PlayersCount,
                            BotsCount = r.BotsCount,
                            OwnerUsername = r.OwnerUsername,
                            ActivePlayers = 0
                        })
                        .ToArray();

                    await _dialogs.ShowInfo(
                        "Rooms",
                        "Serveur non à jour (admin.rooms.list indisponible). Affichage limité aux tables publiques.")
                        .ConfigureAwait(true);
                }
                catch (Exception fallbackEx)
                {
                    await _dialogs.ShowError("Rooms", fallbackEx.Message).ConfigureAwait(true);
                }
                return;
            }

            await _dialogs.ShowError("Rooms", msg.Length == 0 ? ex.GetType().Name : msg).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task OpenRoomsJoinSilentAsync()
    {
        PushReturnFocus();
        if (IsBusy)
        {
            return;
        }

        try
        {
            IsBusy = true;
            var caps = await _apiCapabilities.GetAsync().ConfigureAwait(true);
            if (!caps.SupportsAdminRoomsList)
            {
                var fallback = await _roomDirectory.PublicListAsync().ConfigureAwait(true);
                _roomsForAdmin = (fallback.Items ?? Array.Empty<PublicRoomListItem>())
                    .Select(r => new AdminRoomListItemDto
                    {
                        Id = r.Id,
                        Name = r.Name,
                        GameType = r.GameType,
                        Status = r.Status,
                        IsPrivate = false,
                        MaxPlayers = r.MaxPlayers,
                        PlayersCount = r.PlayersCount,
                        BotsCount = r.BotsCount,
                        OwnerUsername = r.OwnerUsername,
                        ActivePlayers = 0
                    })
                    .ToArray();
                BuildRoomsJoinSilent();
                return;
            }

            // Joinable only: éviter les "tables fantômes" et ne proposer que des tables ouvertes
            // avec au moins un joueur connecté.
            var listed = await _admin.ListRoomsAsync(
                includePrivate: true,
                includeStarted: true,
                joinableOnly: false,
                limit: 200).ConfigureAwait(true);
            _roomsForAdmin = listed.Items ?? Array.Empty<AdminRoomListItemDto>();
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rooms", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }

        BuildRoomsJoinSilent();
    }

    private void BuildRoomsDestroy()
    {
        _page = AdminPage.RoomsDestroy;
        Title = "Détruire une room";
        Items.Clear();

        var listed = _roomsForAdmin ?? Array.Empty<AdminRoomListItemDto>();
        if (listed.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucune table disponible", tag: null));
            SelectedItem = Items.FirstOrDefault();
            Details = "Aucune table à détruire.";
            Status = "Échap : retour.";
        }
        else
        {
            foreach (var room in listed.OrderByDescending(r => r.Id))
            {
                Items.Add(new AdminMenuItem(room.ToString(), tag: $"rooms.destroy.open:{room.Id}"));
            }

            SelectedItem = Items.FirstOrDefault();
            Details = "Détruit la table sélectionnée (publique/privée, même si des joueurs sont dessus).";
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
        var caps = await _apiCapabilities.GetAsync().ConfigureAwait(true);
        if (!caps.SupportsAdminRoomsDestroy)
        {
            await _dialogs.ShowError("Rooms", "Suppression admin indisponible sur ce serveur.").ConfigureAwait(true);
            return;
        }
        await RefreshAdminRoomsListAsync().ConfigureAwait(true);
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
            await RefreshAdminRoomsListAsync().ConfigureAwait(true);
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
            // Mode silencieux admin = non notifié / non listé côté serveur.
            var returnContent = _returnContent();
            if (returnContent == null)
            {
                return;
            }

            await _tables.OpenExistingAsync(roomId, returnContent, spectator: false, silent: true).ConfigureAwait(true);
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
        PrimaryInputAcceptsReturn = true;
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
