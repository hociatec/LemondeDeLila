using System;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using client_win.Modules.Config;
using client_win.Core.Constants;
using Serilog;

namespace client_win.Modules.User.Services;

/// <summary>
/// Validateur de tokens JWT avec mode strict pour la production.
/// En mode strict, la validation ne peut pas être contournée.
/// </summary>
public sealed class JwtTokenValidator
{
    private readonly string? _secret;
    private readonly bool _strictMode;

    /// <summary>
    /// Crée un validateur JWT.
    /// </summary>
    /// <param name="secret">Clé secrète pour la validation. Si null, le mode strict est désactivé automatiquement.</param>
    /// <param name="strictMode">Si true, aucun bypass n'est autorisé. Recommandé pour la production.</param>
    public JwtTokenValidator(string? secret, bool strictMode = false)
    {
        _secret = secret;

        // Détection d'environnement (utile pour le logging et d'éventuelles règles)
        var environment = EnvironmentDetector.GetEnvironment();

        // Le mode strict nécessite une clé secrète
        _strictMode = strictMode && !string.IsNullOrWhiteSpace(secret);

        // Logging
        if (_strictMode)
        {
            if (string.IsNullOrWhiteSpace(secret))
            {
                Log.Warning("SÉCURITÉ: Mode strict JWT activé mais secret manquant - validation sera impossible");
            }
            else
            {
                Log.Information("Mode strict JWT activé - validation complète des tokens");
            }
        }
        else
        {
            if (environment == EnvironmentDetector.AppEnvironment.Production)
            {
                Log.Warning("Mode strict JWT désactivé - validation assouplie (production)");
            }
            else
            {
                Log.Warning("Mode strict JWT désactivé - validation assouplie (développement)");
            }
        }
    }

    public JwtSecurityToken Validate(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new SecurityTokenException("Token manquant");
        }

        var handler = new JwtSecurityTokenHandler();

        // En mode strict, pas de bypass possible
        if (string.IsNullOrWhiteSpace(_secret))
        {
            if (_strictMode)
            {
                throw new SecurityTokenException("Impossible de valider le token : secret JWT manquant et mode strict activé");
            }
            // Mode développement : lecture sans validation
            return handler.ReadJwtToken(token);
        }

        var parameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(AppConstants.JwtClockSkewMinutes)
        };

        try
        {
            handler.ValidateToken(token, parameters, out var validatedToken);
            return (JwtSecurityToken)validatedToken;
        }
        catch (SecurityTokenException ex)
        {
            if (_strictMode)
            {
                // En mode strict, on propage l'exception
                throw new SecurityTokenException($"Validation JWT échouée : {ex.Message}", ex);
            }
            // Mode développement : tentative de lecture sans validation
            return handler.ReadJwtToken(token);
        }
    }
}
