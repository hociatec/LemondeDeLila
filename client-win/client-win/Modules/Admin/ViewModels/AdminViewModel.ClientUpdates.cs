using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Updates;
using Microsoft.Win32;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildClientUpdates()
    {
        _page = AdminPage.ClientUpdates;
        Title = "Mises à jour client";
        Details = string.Empty;
        Items.Clear();
        Items.Add(new AdminMenuItem("Compiler + uploader la mise à jour (admin)", tag: "clientUpdate.buildUpload"));
        Items.Add(new AdminMenuItem("Proposer la mise à jour à tous", tag: "clientUpdate.announce"));
        SelectedItem = Items.FirstOrDefault();
        IsTextInputVisible = false;
        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        SecondaryInputLabel = "Version (nouvelle)";
        SecondaryInput = AppInfo.GetShortVersion();
        IsSecondaryInputVisible = true;
        Status = "Choisis une version plus haute que la dernière publiée. Entrée : exécuter l'action sélectionnée. Échap : retour.";

        _ = PrefillClientUpdateVersionAsync();
    }

    private async Task PrefillClientUpdateVersionAsync()
    {
        try
        {
            var latest = await _publisher.GetLatestPublishedVersionAsync().ConfigureAwait(true);
            if (string.IsNullOrWhiteSpace(latest))
            {
                return;
            }
            if (_page != AdminPage.ClientUpdates)
            {
                return;
            }

            Details = $"Dernière version publiée : {latest}";
            SecondaryInput = _publisher.SuggestNextVersion(latest);
        }
        catch
        {
            // Non bloquant.
        }
    }

    private async Task AnnounceClientUpdateAsync()
    {
        var version = (SecondaryInput ?? string.Empty).Trim();
        IsBusy = true;
        try
        {
            var delivered = await _admin.AnnounceClientUpdateAsync(
                    message: null,
                    version: string.IsNullOrWhiteSpace(version) ? null : version)
                .ConfigureAwait(true);
            await _dialogs.ShowInfo("Mise à jour", $"Proposition envoyée à {delivered} utilisateur(s).").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task BuildAndUploadClientUpdateAsync()
    {
        var version = (SecondaryInput ?? string.Empty).Trim();

        var latest = await _publisher.GetLatestPublishedVersionAsync().ConfigureAwait(true);
        if (!string.IsNullOrWhiteSpace(latest) &&
            !string.IsNullOrWhiteSpace(version) &&
            string.Equals(latest, version, StringComparison.OrdinalIgnoreCase))
        {
            var suggested = _publisher.SuggestNextVersion(latest);
            SecondaryInput = suggested;
            version = suggested;
            await _dialogs.ShowInfo("Mise à jour", $"La version {latest} est déjà publiée. Version ajustée automatiquement en {suggested}.").ConfigureAwait(true);
        }

        IsBusy = true;
        try
        {
            var result = await _publisher.BuildAndUploadAsync(
                    message: null,
                    string.IsNullOrWhiteSpace(version) ? null : version)
                .ConfigureAwait(true);

            if (!result.Success)
            {
                // First-time setup: allow selecting the csproj from the admin UI.
                if (result.StatusMessage.Contains("Projet client introuvable", StringComparison.OrdinalIgnoreCase))
                {
                    var pick = await _dialogs.Confirm(
                            "Mise à jour",
                            result.StatusMessage + "\n\nSélectionner le fichier .csproj maintenant ?")
                        .ConfigureAwait(true);
                    if (pick == true)
                    {
                        var ofd = new OpenFileDialog
                        {
                            Title = "Sélectionner client-win.csproj",
                            Filter = "Projet .NET (*.csproj)|*.csproj",
                            CheckFileExists = true,
                            Multiselect = false
                        };
                        if (ofd.ShowDialog() == true)
                        {
                            var settings = UpdatePublisherLocalSettings.Load() with { ProjectPath = ofd.FileName };
                            settings.Save();
                            result = await _publisher.BuildAndUploadAsync(
                                    message: null,
                                    string.IsNullOrWhiteSpace(version) ? null : version)
                                .ConfigureAwait(true);
                            if (!result.Success)
                            {
                                await _dialogs.ShowError("Mise à jour", result.StatusMessage).ConfigureAwait(true);
                                return;
                            }
                        }
                        else
                        {
                            return;
                        }
                    }
                    else
                    {
                        return;
                    }
                }
                else
                {
                    await _dialogs.ShowError("Mise à jour", result.StatusMessage).ConfigureAwait(true);
                    return;
                }
            }

            var confirm = await _dialogs.Confirm(
                    "Mise à jour",
                    $"{result.StatusMessage}\n\nProposer la mise à jour à tous les clients maintenant ?")
                .ConfigureAwait(true);
            if (confirm == true)
            {
                await AnnounceClientUpdateAsync().ConfigureAwait(true);
            }
            else
            {
                await _dialogs.ShowInfo("Mise à jour", result.StatusMessage).ConfigureAwait(true);
            }
        }
        finally
        {
            IsBusy = false;
        }
    }
}
