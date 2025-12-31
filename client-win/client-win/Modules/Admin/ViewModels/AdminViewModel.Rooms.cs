using System;
using System.Linq;
using System.Threading.Tasks;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildRooms()
    {
        _page = AdminPage.Rooms;
        Title = "Rooms / tables";
        Details = "Outils de maintenance pour les tables (rooms).";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Nettoyer les rooms (tables publiques ouvertes)", tag: "rooms.cleanup.public"));
        Items.Add(new AdminMenuItem("Retour", tag: "back"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
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

