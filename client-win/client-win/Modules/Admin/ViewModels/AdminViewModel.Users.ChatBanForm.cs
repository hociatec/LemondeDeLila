using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildUserChatBanForm(AdminUserDto user)
    {
        _page = AdminPage.UserChatBanForm;
        _selectedUser = user;
        Title = $"Révoquer accès tchat : {user.Username}";

        IsTextInputVisible = true;
        TextInputLabel = "Motif (optionnel)";
        TextInput = string.IsNullOrWhiteSpace(_chatBanReason) ? "Accès tchat révoqué." : _chatBanReason;

        IsSecondaryInputVisible = true;
        SecondaryInputLabel = "Durée (jours, défaut 3650)";
        SecondaryInput = string.IsNullOrWhiteSpace(_chatBanDays) ? "3650" : _chatBanDays;

        Details = "Révoque l'accès au tchat pour l'utilisateur.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider (révoquer)", tag: "userChatBan.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitUserChatBanAsync(AdminUserDto user)
    {
        _chatBanReason = TextInput ?? string.Empty;
        _chatBanDays = SecondaryInput ?? string.Empty;

        int? days = null;
        if (!string.IsNullOrWhiteSpace(_chatBanDays) &&
            int.TryParse(_chatBanDays.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) &&
            parsed > 0)
        {
            days = parsed;
        }

        IsBusy = true;
        try
        {
            await _admin.BanUserFromChatAsync(user.Id, reason: _chatBanReason, durationDays: days).ConfigureAwait(true);
            await LoadUsersAsync(selectUserId: user.Id).ConfigureAwait(true);
            await _dialogs.ShowInfo("Tchat", $"{user.Username} n'a plus accès au tchat.").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
