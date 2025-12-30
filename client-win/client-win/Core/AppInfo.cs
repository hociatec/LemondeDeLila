using System;
using System.Linq;
using System.Reflection;

namespace client_win.Core;

/// <summary>
/// Informations sur l'application (version, etc.).
/// </summary>
public static class AppInfo
{
    private static readonly Lazy<string> _version = new(() =>
    {
        var clickOnce = TryGetClickOnceVersion();
        if (!string.IsNullOrWhiteSpace(clickOnce))
        {
            return clickOnce!;
        }

        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version;
        return version?.ToString() ?? "0.0.0.0";
    });

    private static readonly Lazy<string> _informationalVersion = new(() =>
    {
        var assembly = Assembly.GetExecutingAssembly();
        var attribute = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
        return attribute?.InformationalVersion ?? GetVersion();
    });

    /// <summary>
    /// Version de l'assembly (ex: 1.0.0.0).
    /// </summary>
    public static string GetVersion() => _version.Value;

    /// <summary>
    /// Version informative (ex: 1.0.0-beta1). Utilise AssemblyInformationalVersion si défini.
    /// </summary>
    public static string GetInformationalVersion() => _informationalVersion.Value;

    /// <summary>
    /// Version courte (ex: 1.0.0) - Retire le 4ème composant si .0.
    /// </summary>
    public static string GetShortVersion()
    {
        var version = GetVersion();
        var parts = version.Split('.');
        if (parts.Length >= 4 && parts[3] == "0")
        {
            return string.Join(".", parts.Take(3));
        }
        return version;
    }

    /// <summary>
    /// Version formatée pour affichage dans l'UI (ex: "v1.0.0").
    /// </summary>
    public static string GetDisplayVersion() => $"v{GetShortVersion()}";

    private static string? TryGetClickOnceVersion()
    {
        // IMPORTANT: reflection only (System.Deployment n'est pas dispo sur Linux).
        try
        {
            var deploymentType = Type.GetType(
                "System.Deployment.Application.ApplicationDeployment, System.Deployment",
                throwOnError: false);
            if (deploymentType == null)
            {
                return null;
            }

            var isNetworkDeployedProp = deploymentType.GetProperty(
                "IsNetworkDeployed",
                BindingFlags.Public | BindingFlags.Static);
            var isNetworkDeployed =
                isNetworkDeployedProp?.PropertyType == typeof(bool) &&
                (bool)(isNetworkDeployedProp.GetValue(null) ?? false);
            if (!isNetworkDeployed)
            {
                return null;
            }

            var currentDeploymentProp = deploymentType.GetProperty(
                "CurrentDeployment",
                BindingFlags.Public | BindingFlags.Static);
            var currentDeployment = currentDeploymentProp?.GetValue(null);
            if (currentDeployment == null)
            {
                return null;
            }

            var currentVersionProp = currentDeployment.GetType().GetProperty(
                "CurrentVersion",
                BindingFlags.Public | BindingFlags.Instance);
            var version = currentVersionProp?.GetValue(currentDeployment) as Version;
            return version?.ToString();
        }
        catch
        {
            return null;
        }
    }
}
