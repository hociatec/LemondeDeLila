using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
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
}
