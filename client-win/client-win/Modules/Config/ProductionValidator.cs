using Serilog;

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
    /// <exception cref="ConfigValidationException">Si la configuration est invalide pour la production.</exception>
    public static void ValidateProductionRequirements(EnvironmentDetector.AppEnvironment environment)
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

        // 1. Vérifier JWT_STRICT_MODE
        var jwtStrictMode = Environment.GetEnvironmentVariable("JWT_STRICT_MODE");
        if (!string.Equals(jwtStrictMode, "true", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("JWT_STRICT_MODE doit être défini à 'true' en production.");
        }

        // 2. Vérifier JWT_SECRET (obligatoire si strict mode activé)
        if (string.Equals(jwtStrictMode, "true", StringComparison.OrdinalIgnoreCase))
        {
            var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET");
            if (string.IsNullOrWhiteSpace(jwtSecret))
            {
                errors.Add("JWT_SECRET est requis lorsque JWT_STRICT_MODE=true.");
            }
            else if (jwtSecret.Length < 32)
            {
                errors.Add("JWT_SECRET doit contenir au moins 32 caractères pour être sécurisé.");
            }
        }

        // 3. Vérifier WS Shared Secret (déjà validé dans ClientConfiguration, mais on double-check)
        var wsSecret = Environment.GetEnvironmentVariable("NETWORK_WS_SECRET")
                       ?? Environment.GetEnvironmentVariable("WS_SHARED_SECRET");
        if (string.IsNullOrWhiteSpace(wsSecret))
        {
            errors.Add("NETWORK_WS_SECRET ou WS_SHARED_SECRET est requis.");
        }
        else if (wsSecret.Length < 16)
        {
            errors.Add("NETWORK_WS_SECRET/WS_SHARED_SECRET doit contenir au moins 16 caractères.");
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
    public static void LogConfiguration()
    {
        var environment = EnvironmentDetector.GetEnvironment();
        var jwtStrictMode = Environment.GetEnvironmentVariable("JWT_STRICT_MODE");
        var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET");
        var wsSecret = Environment.GetEnvironmentVariable("NETWORK_WS_SECRET")
                       ?? Environment.GetEnvironmentVariable("WS_SHARED_SECRET");

        Log.Information("=== Configuration de Sécurité ===");
        Log.Information("Environnement: {Environment}", environment);
        Log.Information("JWT Strict Mode: {JwtStrictMode}", jwtStrictMode ?? "false");
        Log.Information("JWT Secret: {JwtSecret}", string.IsNullOrWhiteSpace(jwtSecret) ? "(non défini)" : "*****");
        Log.Information("WS Shared Secret: {WsSecret}", string.IsNullOrWhiteSpace(wsSecret) ? "(non défini)" : "*****");
        Log.Information("=================================");
    }
}
