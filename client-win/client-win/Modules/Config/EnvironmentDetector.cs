using System.Diagnostics;

namespace client_win.Modules.Config;

/// <summary>
/// Détecte l'environnement d'exécution (Development, Staging, Production).
/// </summary>
public static class EnvironmentDetector
{
    public enum AppEnvironment
    {
        Development,
        Staging,
        Production
    }

    /// <summary>
    /// Détecte l'environnement actuel basé sur les variables d'environnement et le debugger.
    /// </summary>
    /// <returns>L'environnement détecté.</returns>
    public static AppEnvironment GetEnvironment()
    {
        // 1. Vérifier variables d'environnement explicites
        var envVar = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
                     ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                     ?? Environment.GetEnvironmentVariable("APP_ENVIRONMENT");

        if (!string.IsNullOrWhiteSpace(envVar))
        {
            if (envVar.Equals("Production", StringComparison.OrdinalIgnoreCase))
                return AppEnvironment.Production;

            if (envVar.Equals("Staging", StringComparison.OrdinalIgnoreCase))
                return AppEnvironment.Staging;

            if (envVar.Equals("Development", StringComparison.OrdinalIgnoreCase))
                return AppEnvironment.Development;
        }

        // 2. Si debugger attaché → Development
        if (Debugger.IsAttached)
            return AppEnvironment.Development;

        // 3. Par défaut → Production hors debug (plus sûr pour les builds distribués).
        // Pour développer/local, définir explicitement DOTNET_ENVIRONMENT=Development.
        return AppEnvironment.Production;
    }

    /// <summary>
    /// Indique si l'environnement actuel est Production.
    /// </summary>
    public static bool IsProduction() => GetEnvironment() == AppEnvironment.Production;

    /// <summary>
    /// Indique si l'environnement actuel est Development.
    /// </summary>
    public static bool IsDevelopment() => GetEnvironment() == AppEnvironment.Development;

    /// <summary>
    /// Indique si l'environnement actuel est Staging.
    /// </summary>
    public static bool IsStaging() => GetEnvironment() == AppEnvironment.Staging;
}
