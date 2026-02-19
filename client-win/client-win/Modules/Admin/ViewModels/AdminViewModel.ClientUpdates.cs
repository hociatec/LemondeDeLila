using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildClientUpdates()
    {
        _page = AdminPage.ClientUpdates;
        Title = "Mises a jour client";
        Details = "Renseigne le delai et le message. La publication et la distribution seront lancees a l'echeance.";
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
        ClientUpdateDelayMinutes = "1";
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
        if (!int.TryParse(raw, out var minutes) || minutes < 1 || minutes > 1440)
        {
            await _dialogs.ShowError("Mise a jour", "Delai invalide. Entrez une valeur entre 1 et 1440 minutes.").ConfigureAwait(true);
            return;
        }

        IsBusy = true;
        try
        {
            var message = NormalizeClientUpdateMessage();
            var (delivered, delaySeconds, scheduledAt) = await _admin
                .ScheduleClientUpdateAsync(minutes, message)
                .ConfigureAwait(true);

            ArmClientUpdatePublishTimer(delaySeconds, message);

            var delayShown = Math.Max(1, (int)Math.Round(delaySeconds / 60.0));
            var when = scheduledAt;
            if (DateTimeOffset.TryParse(scheduledAt, out var dt))
            {
                when = dt.LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss");
            }

            await _dialogs.ShowInfo(
                    "Mise a jour",
                    $"Alerte envoyee a {delivered} utilisateur(s). Publication/distribution dans {delayShown} minute(s), vers {when}.")
                .ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ArmClientUpdatePublishTimer(int delaySeconds, string? message)
    {
        try
        {
            _clientUpdatePublishCts?.Cancel();
            _clientUpdatePublishCts?.Dispose();
        }
        catch
        {
            // ignore
        }

        var effectiveDelaySeconds = Math.Max(60, delaySeconds);
        var cts = new CancellationTokenSource();
        _clientUpdatePublishCts = cts;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(effectiveDelaySeconds), cts.Token).ConfigureAwait(false);
                if (cts.IsCancellationRequested)
                {
                    return;
                }

                await (await _dispatcher.InvokeAsync(async () =>
                {
                    if (cts.IsCancellationRequested)
                    {
                        return;
                    }

                    IsBusy = true;
                    try
                    {
                        var publish = await _publisher
                            .BuildAndUploadAsync(message, version: null, cts.Token)
                            .ConfigureAwait(true);

                        if (!publish.Success)
                        {
                            await _dialogs.ShowError("Mise a jour", publish.StatusMessage).ConfigureAwait(true);
                            return;
                        }

                        var (delivered, minRequiredVersion) = await _admin
                            .ForceClientUpdateLatestAsync(message, cts.Token)
                            .ConfigureAwait(true);

                        await _dialogs.ShowInfo(
                                "Mise a jour",
                                $"Version publiee: {(publish.PublishedVersion ?? minRequiredVersion)}. " +
                                $"Mise a jour forcee envoyee a {delivered} utilisateur(s).")
                            .ConfigureAwait(true);
                    }
                    finally
                    {
                        IsBusy = false;
                    }
                }, DispatcherPriority.Background)).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                await _dispatcher.InvokeAsync(async () =>
                {
                    try
                    {
                        await _dialogs.ShowError("Mise a jour", ex.Message).ConfigureAwait(true);
                    }
                    catch
                    {
                        // ignore
                    }
                }, DispatcherPriority.Background);
            }
        });
    }
}
