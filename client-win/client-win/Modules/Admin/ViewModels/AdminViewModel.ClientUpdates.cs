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
        Items.Add(new AdminMenuItem("Forcer la mise à jour (bloquer les anciens clients)", tag: "clientUpdate.forceLatest"));
        SelectedItem = Items.FirstOrDefault();
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        SecondaryInputLabel = "Version (automatique)";
        SecondaryInput = _publisher.SuggestNextVersion(AppInfo.GetShortVersion());
        SecondaryInputAcceptsReturn = false;
        ClientUpdateMessage = string.Empty;
        PreferDetailsFocus = false;
        Status = "La version est calculée automatiquement. Publie puis diffuse la mise à jour.";

        _ = RefreshAutomaticClientUpdateVersionAsync();
    }

    private async Task<string?> TryGetLatestPublishedClientVersionAsync()
    {
        try
        {
            var latest = await _publisher.GetLatestPublishedVersionAsync().ConfigureAwait(true);
            return string.IsNullOrWhiteSpace(latest) ? null : latest.Trim();
        }
        catch
        {
            // Non bloquant.
            return null;
        }
    }

    private async Task<string> RefreshAutomaticClientUpdateVersionAsync()
    {
        var latest = await TryGetLatestPublishedClientVersionAsync().ConfigureAwait(true);
        var next = ComputeAutomaticClientUpdateVersion(latest);

        if (_page == AdminPage.ClientUpdates)
        {
            Details = string.IsNullOrWhiteSpace(latest)
                ? "Dernière version publiée : inconnue (calcul local)"
                : $"Dernière version publiée : {latest}";
            SecondaryInput = next;
        }

        return next;
    }

    private string ComputeAutomaticClientUpdateVersion(string? latestPublished)
    {
        if (TryParseComparableVersion(latestPublished, out var latestVersion))
        {
            var suggested = (_publisher.SuggestNextVersion(latestPublished) ?? string.Empty).Trim();
            if (TryParseComparableVersion(suggested, out var suggestedVersion) && suggestedVersion > latestVersion)
            {
                return suggested;
            }

            return $"{latestVersion.Major}.{latestVersion.Minor}.{latestVersion.Build + 1}";
        }

        var fromLocal = (_publisher.SuggestNextVersion(AppInfo.GetShortVersion()) ?? string.Empty).Trim();
        if (TryParseComparableVersion(fromLocal, out _))
        {
            return fromLocal;
        }

        return "1.0.1";
    }

    private static bool TryParseComparableVersion(string? value, out Version parsed)
    {
        parsed = new Version(0, 0, 0, 0);

        var raw = (value ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var parts = raw.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length is < 1 or > 4)
        {
            return false;
        }

        var nums = new int[4];
        for (var i = 0; i < parts.Length; i++)
        {
            if (!int.TryParse(parts[i], out var current) || current < 0)
            {
                return false;
            }

            nums[i] = current;
        }

        parsed = new Version(nums[0], nums[1], nums[2], nums[3]);
        return true;
    }

    private async Task ForceClientUpdateLatestAsync()
    {
        IsBusy = true;
        try
        {
            var (delivered, min) = await _admin
                .ForceClientUpdateLatestAsync(message: NormalizeClientUpdateMessage())
                .ConfigureAwait(true);
            var suffix = string.IsNullOrWhiteSpace(min) ? string.Empty : $" (min: {min})";
            await _dialogs.ShowInfo("Mise à jour", $"Mise à jour forcée pour {delivered} utilisateur(s){suffix}.").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private Task AnnounceClientUpdateAsync()
        => AnnounceClientUpdateInternalAsync(null);

    private async Task AnnounceClientUpdateInternalAsync(string? forcedVersion)
    {
        var version = (forcedVersion ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(version))
        {
            var latest = await TryGetLatestPublishedClientVersionAsync().ConfigureAwait(true);
            if (!string.IsNullOrWhiteSpace(latest))
            {
                version = latest;
                if (_page == AdminPage.ClientUpdates)
                {
                    Details = $"Dernière version publiée : {latest}";
                    SecondaryInput = ComputeAutomaticClientUpdateVersion(latest);
                }
            }
        }

        IsBusy = true;
        try
        {
            var delivered = await _admin.AnnounceClientUpdateAsync(
                    message: NormalizeClientUpdateMessage(),
                    version: string.IsNullOrWhiteSpace(version) ? null : version)
                .ConfigureAwait(true);

            var details = string.IsNullOrWhiteSpace(version)
                ? $"Proposition envoyée à {delivered} utilisateur(s)."
                : $"Proposition ({version}) envoyée à {delivered} utilisateur(s).";
            await _dialogs.ShowInfo("Mise à jour", details).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task BuildAndUploadClientUpdateAsync()
    {
        var version = await RefreshAutomaticClientUpdateVersionAsync().ConfigureAwait(true);
        var message = NormalizeClientUpdateMessage();

        IsBusy = true;
        try
        {
            var result = await _publisher.BuildAndUploadAsync(
                    message: message,
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
                                    version)
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

            await RefreshAutomaticClientUpdateVersionAsync().ConfigureAwait(true);

            var confirm = await _dialogs.Confirm(
                    "Mise à jour",
                    $"{result.StatusMessage}\n\nProposer la mise à jour à tous les clients maintenant ?")
                .ConfigureAwait(true);
            if (confirm == true)
            {
                var publishedVersion = (result.PublishedVersion ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(publishedVersion))
                {
                    publishedVersion = version;
                }

                await AnnounceClientUpdateInternalAsync(publishedVersion).ConfigureAwait(true);
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

    private string? NormalizeClientUpdateMessage()
    {
        var msg = (ClientUpdateMessage ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(msg) ? null : msg;
    }
}
