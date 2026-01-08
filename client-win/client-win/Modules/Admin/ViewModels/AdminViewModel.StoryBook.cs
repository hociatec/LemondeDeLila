using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildStoryBook()
    {
        _page = AdminPage.StoryBook;
        Title = "Livre des contes";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();

        Items.Add(new AdminMenuItem("Réinitialiser le livre des contes (tout le monde)", tag: "storybook.resetAll"));
        Items.Add(new AdminMenuItem("Consulter le livre des contes d'un utilisateur", tag: "storybook.openUser"));

        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task ResetStoryBookForEveryoneAsync()
    {
        if (IsBusy)
        {
            return;
        }

        var ok = await _dialogs.Confirm(
                "Livre des contes",
                "Confirmer la réinitialisation du livre des contes pour tout le monde ?",
                okText: "Réinitialiser",
                cancelText: "Annuler")
            .ConfigureAwait(true);

        if (ok != true)
        {
            Status = "Annulé.";
            return;
        }

        IsBusy = true;
        Status = "Réinitialisation...";
        try
        {
            await _admin.ResetAllStoryBookAsync().ConfigureAwait(true);
            Status = "Livre des contes réinitialisé.";
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Livre des contes", ex.Message).ConfigureAwait(true);
            Status = "Échec réinitialisation.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task BeginPickUserForStoryBookAsync()
    {
        _userPickMode = "storybook";
        await LoadUsersAsync().ConfigureAwait(true);
    }

    private async Task OpenStoryBookForUserAsync(AdminUserDto user)
    {
        if (_openStoryBookForUser == null)
        {
            Status = "Ouverture indisponible.";
            return;
        }

        _userPickMode = null;
        Status = await _openStoryBookForUser(user.Id, user.Username).ConfigureAwait(true);
    }
}
