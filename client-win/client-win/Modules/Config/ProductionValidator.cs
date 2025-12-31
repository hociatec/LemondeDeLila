using Serilog;
using System.Collections.Generic;

namespace client_win.Modules.Config;

/// <summary>
/// Valide que toutes les exigences de sécurité sont remplies pour un environnement de production.
/// </summary>
public static class ProductionValidator
{
    /// <summary>
    /// Valide les exigences de production. Lance ConfigValidationException si la validation échoue.
    /// </summary>
    /// <param name="environment">L'environnement détecté.</param>
    /// <param name="config">Configuration client résolue (fichier + env).</param>
    /// <param name="jwtStrictMode">Mode strict JWT (opt-in via env).</param>
    /// <exception cref="ConfigValidationException">Si la configuration est invalide pour la production.</exception>
    public static void ValidateProductionRequirements(
        EnvironmentDetector.AppEnvironment environment,
        ClientConfiguration config,
        bool jwtStrictMode)
    {
        Log.Information("Validation des exigences pour environnement: {Environment}", environment);

        // En développement, on est plus tolérant
        if (environment == EnvironmentDetector.AppEnvironment.Development)
        {
            Log.Warning("Environnement Development détecté - validation de sécurité assouplie");
            return;
        }

        // En Staging ou Production, on applique les règles strictes
        var errors = new List<string>();

        // 1. JWT strict mode est opt-in (ne pas obliger un secret en client en prod).
        // Si activé, il exige un secret suffisamment robuste.
        if (jwtStrictMode)
        {
            if (string.IsNullOrWhiteSpace(config.JwtSecret))
            {
                errors.Add("JWT_SECRET est requis lorsque JWT_STRICT_MODE=true.");
            }
            else if (config.JwtSecret.Length < 32)
            {
                errors.Add("JWT_SECRET doit contenir au moins 32 caractères pour être sécurisé.");
            }
        }

        // Si des erreurs ont été détectées, on fail
        if (errors.Count > 0)
        {
            var errorMessage = string.Join("\n  - ", errors);
            Log.Fatal("Validation de sécurité échouée pour environnement {Environment}:\n  - {Errors}",
                environment, errorMessage);

            throw new ConfigValidationException(
                $"Configuration de sécurité invalide pour l'environnement {environment}:\n  - {errorMessage}\n\n" +
                "Veuillez définir les variables d'environnement requises avant de démarrer l'application.");
        }

        Log.Information("✓ Validation de sécurité réussie pour environnement {Environment}", environment);
    }

    /// <summary>
    /// Log les informations de configuration (en masquant les secrets).
    /// </summary>
    public static void LogConfiguration(ClientConfiguration config, bool jwtStrictMode)
    {
        var environment = EnvironmentDetector.GetEnvironment();

        Log.Information("=== Configuration de Sécurité ===");
        Log.Information("Environnement: {Environment}", environment);
        Log.Information("JWT Strict Mode: {JwtStrictMode}", jwtStrictMode);
        Log.Information("JWT Secret: {JwtSecret}", string.IsNullOrWhiteSpace(config.JwtSecret) ? "(non défini)" : "*****");
        Log.Information("=================================");
    }
}
