using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

public static class ClientUpdateManager
{
    private const string RestartHint = "\n\nSi l'application ne se relance pas automatiquement apres la mise a jour, relance-la.";

    private static readonly TimeSpan[] StartupProbeDelays =
    {
        TimeSpan.Zero,
        TimeSpan.FromMilliseconds(400),
        TimeSpan.FromMilliseconds(900),
    };

    private static readonly TimeSpan[] RetryProbeDelays =
    {
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(4),
        TimeSpan.FromSeconds(8),
    };

    public static async Task<bool> CheckAtStartupAsync(
        ClientConfiguration config,
        IDialogService dialogs,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var info = await TryGetServerInfoWithRetriesAsync(config, StartupProbeDelays, cancellationToken)
                .ConfigureAwait(true);
            if (info != null)
            {
                return await HandleServerInfoAsync(dialogs, info, source: "startup", cancellationToken)
                    .ConfigureAwait(true);
            }

            info = await TryGetServerInfoWithRetriesAsync(config, RetryProbeDelays, cancellationToken)
                .ConfigureAwait(true);
            if (info != null)
            {
                return await HandleServerInfoAsync(dialogs, info, source: "startup-retry", cancellationToken)
                    .ConfigureAwait(true);
            }

            return true;
        }
        catch
        {
            return true;
        }
    }

    public static Task HandleRequiredFromNotifyAsync(
        IDialogService dialogs,
        string? message,
        string? minRequiredVersion,
        string? url,
        CancellationToken cancellationToken = default)
    {
        var msg = string.IsNullOrWhiteSpace(message)
            ? "Une mise a jour du client est requise pour continuer."
            : message.Trim();

        var current = AppInfo.GetShortVersion();
        if (!string.IsNullOrWhiteSpace(minRequiredVersion))
        {
            msg += $"\n\nVersion minimale requise : {minRequiredVersion.Trim()}";
        }

        if (!string.IsNullOrWhiteSpace(current))
        {
            msg += $"\nVotre version : {current.Trim()}";
        }

        return ClientUpdateCoordinator.EnforceAsync(
            dialogs,
            title: "Mise a jour requise",
            message: msg + "\n\nLancement de la mise a jour..." + RestartHint,
            clickOnceUrl: url,
            reason: "notify-required",
            required: true,
            deDupKey: $"notify-required:{minRequiredVersion}",
            cancellationToken: cancellationToken);
    }

    public static Task HandleAvailableFromNotifyAsync(
        IDialogService dialogs,
        string? message,
        string? latestVersion,
        string? url,
        CancellationToken cancellationToken = default)
    {
        var msg = string.IsNullOrWhiteSpace(message)
            ? "Une mise a jour du client est disponible et va etre installee automatiquement."
            : message.Trim();

        if (!string.IsNullOrWhiteSpace(latestVersion))
        {
            msg += $"\n\nDerniere version : {latestVersion.Trim()}";
        }

        return ClientUpdateCoordinator.EnforceAsync(
            dialogs,
            title: "Mise a jour",
            message: msg + "\n\nLancement de la mise a jour..." + RestartHint,
            clickOnceUrl: url,
            reason: "notify-available",
            required: false,
            deDupKey: $"notify-available:{latestVersion}",
            cancellationToken: cancellationToken);
    }

    public static async Task HandleRequiredFromErrorAsync(
        ClientConfiguration config,
        IDialogService dialogs,
        string? errorMessage,
        CancellationToken cancellationToken = default)
    {
        var info = await ClientUpdateApi.GetAsync(config, forceRefresh: true, cancellationToken)
            .ConfigureAwait(false);
        var url = info?.Url;
        var min = info?.MinRequiredVersion;

        var msg = (errorMessage ?? string.Empty).Trim();
        if (msg.Length == 0)
        {
            msg = "Une mise a jour du client est requise pour continuer.";
        }

        if (!string.IsNullOrWhiteSpace(min) &&
            msg.IndexOf("version minimale", StringComparison.OrdinalIgnoreCase) < 0)
        {
            msg += $"\n\nVersion minimale requise : {min.Trim()}";
        }

        msg += "\n\nLancement de la mise a jour..." + RestartHint;

        await ClientUpdateCoordinator.EnforceAsync(
                dialogs,
                title: "Mise a jour requise",
                message: msg,
                clickOnceUrl: url,
                reason: "shell-required",
                required: true,
                deDupKey: $"shell-required:{min}",
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    private static async Task<bool> HandleServerInfoAsync(
        IDialogService dialogs,
        ClientUpdateInfo? info,
        string source,
        CancellationToken cancellationToken)
    {
        if (info == null)
        {
            return true;
        }

        var currentVersion = AppInfo.GetShortVersion();
        var latestVersion = (info.LatestVersion ?? string.Empty).Trim();
        var hasNewerVersion = IsCandidateVersionGreater(currentVersion, latestVersion);
        var effectiveUpdateAvailable = info.UpdateAvailable == true || hasNewerVersion;

        if (info.UpdateRequired == true)
        {
            var msg = "Une mise a jour du client est requise pour continuer.";
            if (!string.IsNullOrWhiteSpace(info.MinRequiredVersion))
            {
                msg += $"\n\nVersion minimale requise : {info.MinRequiredVersion.Trim()}";
            }

            if (!string.IsNullOrWhiteSpace(latestVersion))
            {
                msg += $"\nDerniere version : {latestVersion}";
            }

            if (!string.IsNullOrWhiteSpace(info.Message))
            {
                msg += $"\n\n{info.Message.Trim()}";
            }

            await ClientUpdateCoordinator.EnforceAsync(
                    dialogs,
                    title: "Mise a jour requise",
                    message: msg + "\n\nLancement de la mise a jour..." + RestartHint,
                    clickOnceUrl: info.Url,
                    reason: $"{source}-required",
                    required: true,
                    deDupKey: $"{source}-required:{info.MinRequiredVersion}:{info.LatestVersion}",
                    cancellationToken: cancellationToken)
                .ConfigureAwait(true);
            return false;
        }

        if (effectiveUpdateAvailable)
        {
            var msg = "Une mise a jour du client est disponible et va etre installee automatiquement.";
            if (!string.IsNullOrWhiteSpace(latestVersion))
            {
                msg += $"\n\nDerniere version : {latestVersion}";
            }

            if (!string.IsNullOrWhiteSpace(info.Message))
            {
                msg += $"\n\n{info.Message.Trim()}";
            }

            await ClientUpdateCoordinator.EnforceAsync(
                    dialogs,
                    title: "Mise a jour",
                    message: msg + "\n\nLancement de la mise a jour..." + RestartHint,
                    clickOnceUrl: info.Url,
                    reason: $"{source}-available",
                    required: false,
                    deDupKey: $"{source}-available:{info.LatestVersion}",
                    cancellationToken: cancellationToken)
                .ConfigureAwait(true);
            return false;
        }

        return true;
    }

    private static async Task<ClientUpdateInfo?> TryGetServerInfoWithRetriesAsync(
        ClientConfiguration config,
        IReadOnlyList<TimeSpan> delays,
        CancellationToken cancellationToken)
    {
        if (delays == null || delays.Count == 0)
        {
            return await ClientUpdateApi.GetAsync(config, forceRefresh: true, cancellationToken)
                .ConfigureAwait(true);
        }

        for (var i = 0; i < delays.Count; i++)
        {
            var delay = delays[i];
            if (delay > TimeSpan.Zero)
            {
                await Task.Delay(delay, cancellationToken).ConfigureAwait(true);
            }

            var info = await ClientUpdateApi.GetAsync(config, forceRefresh: true, cancellationToken)
                .ConfigureAwait(true);
            if (info != null)
            {
                return info;
            }
        }

        return null;
    }

    private static bool IsCandidateVersionGreater(string current, string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return false;
        }

        var candidateParts = ParseVersionParts(candidate);
        if (candidateParts.Length == 0)
        {
            return false;
        }

        var currentParts = ParseVersionParts(current);
        var length = Math.Max(currentParts.Length, candidateParts.Length);
        for (var i = 0; i < length; i++)
        {
            var left = i < currentParts.Length ? currentParts[i] : 0;
            var right = i < candidateParts.Length ? candidateParts[i] : 0;
            if (right > left)
            {
                return true;
            }

            if (right < left)
            {
                return false;
            }
        }

        return false;
    }

    private static int[] ParseVersionParts(string? version)
    {
        if (string.IsNullOrWhiteSpace(version))
        {
            return Array.Empty<int>();
        }

        var normalized = version.Trim();
        if (normalized.StartsWith("v", StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized.Substring(1);
        }

        var segments = normalized.Split('.');
        var parts = new List<int>(segments.Length);
        foreach (var segment in segments)
        {
            if (string.IsNullOrWhiteSpace(segment))
            {
                parts.Add(0);
                continue;
            }

            var digits = new string(segment.TakeWhile(char.IsDigit).ToArray());
            if (digits.Length == 0)
            {
                break;
            }

            if (int.TryParse(digits, out var value))
            {
                parts.Add(value);
                continue;
            }

            break;
        }

        return parts.ToArray();
    }

}
