using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

public static class ClientUpdateManager
{
    public static async Task<bool> CheckAtStartupAsync(
        ClientConfiguration config,
        IDialogService dialogs,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var info = await ClientUpdateApi.GetAsync(config, cancellationToken).ConfigureAwait(true);
            return await HandleServerInfoAsync(dialogs, info, source: "startup", cancellationToken).ConfigureAwait(true);
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
            ? "Une mise à jour du client est requise pour continuer."
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
            title: "Mise à jour requise",
            message: msg + "\n\nLancement de la mise à jour…",
            clickOnceUrl: url,
            reason: "notify-required",
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
            ? "Une mise à jour du client est disponible et va être installée automatiquement."
            : message.Trim();

        if (!string.IsNullOrWhiteSpace(latestVersion))
        {
            msg += $"\n\nDernière version : {latestVersion.Trim()}";
        }

        return ClientUpdateCoordinator.EnforceAsync(
            dialogs,
            title: "Mise à jour",
            message: msg + "\n\nLancement de la mise à jour…",
            clickOnceUrl: url,
            reason: "notify-available",
            deDupKey: $"notify-available:{latestVersion}",
            cancellationToken: cancellationToken);
    }

    public static async Task HandleRequiredFromErrorAsync(
        ClientConfiguration config,
        IDialogService dialogs,
        string? errorMessage,
        CancellationToken cancellationToken = default)
    {
        var info = await ClientUpdateApi.GetAsync(config, cancellationToken).ConfigureAwait(false);
        var url = info?.Url;
        var min = info?.MinRequiredVersion;

        var msg = (errorMessage ?? string.Empty).Trim();
        if (msg.Length == 0)
        {
            msg = "Une mise à jour du client est requise pour continuer.";
        }

        if (!string.IsNullOrWhiteSpace(min) &&
            msg.IndexOf("version minimale", StringComparison.OrdinalIgnoreCase) < 0)
        {
            msg += $"\n\nVersion minimale requise : {min.Trim()}";
        }
        msg += "\n\nLancement de la mise à jour…";

        await ClientUpdateCoordinator.EnforceAsync(
                dialogs,
                title: "Mise à jour requise",
                message: msg,
                clickOnceUrl: url,
                reason: "shell-required",
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

        if (info.UpdateRequired == true)
        {
            var msg = "Une mise à jour du client est requise pour continuer.";
            if (!string.IsNullOrWhiteSpace(info.MinRequiredVersion))
            {
                msg += $"\n\nVersion minimale requise : {info.MinRequiredVersion.Trim()}";
            }
            if (!string.IsNullOrWhiteSpace(info.LatestVersion))
            {
                msg += $"\nDernière version : {info.LatestVersion.Trim()}";
            }
            if (!string.IsNullOrWhiteSpace(info.Message))
            {
                msg += $"\n\n{info.Message.Trim()}";
            }

            await ClientUpdateCoordinator.EnforceAsync(
                    dialogs,
                    title: "Mise à jour requise",
                    message: msg + "\n\nLancement de la mise à jour…",
                    clickOnceUrl: info.Url,
                    reason: $"{source}-required",
                    deDupKey: $"{source}-required:{info.MinRequiredVersion}:{info.LatestVersion}",
                    cancellationToken: cancellationToken)
                .ConfigureAwait(true);
            return false;
        }

        if (info.UpdateAvailable == true)
        {
            var msg = "Une mise à jour du client est disponible et va être installée automatiquement.";
            if (!string.IsNullOrWhiteSpace(info.LatestVersion))
            {
                msg += $"\n\nDernière version : {info.LatestVersion.Trim()}";
            }
            if (!string.IsNullOrWhiteSpace(info.Message))
            {
                msg += $"\n\n{info.Message.Trim()}";
            }

            await ClientUpdateCoordinator.EnforceAsync(
                    dialogs,
                    title: "Mise à jour",
                    message: msg + "\n\nLancement de la mise à jour…",
                    clickOnceUrl: info.Url,
                    reason: $"{source}-available",
                    deDupKey: $"{source}-available:{info.LatestVersion}",
                    cancellationToken: cancellationToken)
                .ConfigureAwait(true);
            return false;
        }

        return true;
    }
}

