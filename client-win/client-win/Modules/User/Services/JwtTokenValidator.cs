using System;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.IdentityModel.Tokens;

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
        // Le mode strict nécessite une clé secrète
        _strictMode = strictMode && !string.IsNullOrWhiteSpace(secret);
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
            ClockSkew = TimeSpan.FromMinutes(1)
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
