using System;
using System.Linq;
using System.Threading.Tasks;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildBroadcast()
    {
        _page = AdminPage.Broadcast;
        Title = "Message global";
        Details = string.Empty;
        Items.Clear();
        Items.Add(new AdminMenuItem("Envoyer", tag: "broadcast.send"));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = "Message";
        TextInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        Status = "Saisissez le message. Entrée : envoyer. Échap : retour.";
    }

    private async Task SendBroadcastAsync()
    {
        var msg = (TextInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(msg))
        {
            await _dialogs.ShowError("Message global", "Message vide.").ConfigureAwait(true);
            return;
        }
        IsBusy = true;
        try
        {
            var delivered = await _admin.BroadcastAsync(msg).ConfigureAwait(true);
            await _dialogs.ShowInfo("Message global", $"Envoyé à {delivered} utilisateur(s).").ConfigureAwait(true);
            TextInput = string.Empty;
        }
        finally
        {
            IsBusy = false;
        }
    }
}

