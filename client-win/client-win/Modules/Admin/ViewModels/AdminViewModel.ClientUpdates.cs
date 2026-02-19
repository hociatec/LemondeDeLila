using System;
using System.Linq;
using System.Threading.Tasks;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildClientUpdates()
    {
        _page = AdminPage.ClientUpdates;
        Title = "Mises a jour client";
        Details = "Renseigne le delai, le message, puis valide.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider la mise a jour", tag: "clientUpdate.schedule"));
        SelectedItem = Items.FirstOrDefault();
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        SecondaryInputAcceptsReturn = false;
        ClientUpdateMessage = string.Empty;
        ClientUpdateDelayMinutes = "5";
        PreferDetailsFocus = false;
        Status = "Tabulation: delai -> message -> valider.";
    }

    private string? NormalizeClientUpdateMessage()
    {
        var msg = (ClientUpdateMessage ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(msg) ? null : msg;
    }

    private async Task ScheduleClientUpdateAsync()
    {
        var raw = (ClientUpdateDelayMinutes ?? string.Empty).Trim();
        if (!int.TryParse(raw, out var minutes) || minutes < 5 || minutes > 1440)
        {
            await _dialogs.ShowError("Mise a jour", "Delai invalide. Entrez une valeur entre 5 et 1440 minutes.").ConfigureAwait(true);
            return;
        }

        IsBusy = true;
        try
        {
            var (delivered, delaySeconds, scheduledAt) = await _admin
                .ScheduleClientUpdateAsync(minutes, NormalizeClientUpdateMessage())
                .ConfigureAwait(true);

            var delayShown = Math.Max(1, (int)Math.Round(delaySeconds / 60.0));
            var when = scheduledAt;
            if (DateTimeOffset.TryParse(scheduledAt, out var dt))
            {
                when = dt.LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss");
            }

            await _dialogs.ShowInfo(
                    "Mise a jour",
                    $"Alerte envoyee a {delivered} utilisateur(s). Mise a jour dans {delayShown} minute(s), vers {when}.")
                .ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
