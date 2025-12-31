using System;
using System.IdentityModel.Tokens.Jwt;
using client_win.Modules.Config;
using client_win.Core.Constants;
using Serilog;

namespace client_win.Modules.User.Services;

/// <summary>
/// Décode un token JWT (sans validation de signature).
/// IMPORTANT: un client ne doit jamais embarquer le secret de signature du serveur.
/// </summary>
public sealed class JwtTokenValidator
{
    public JwtTokenValidator()
    {
        var environment = EnvironmentDetector.GetEnvironment();
        Log.Information("JWT decoding mode (no signature verification). Environment={Environment}", environment);
    }

    public JwtSecurityToken Validate(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new Microsoft.IdentityModel.Tokens.SecurityTokenException("Token manquant");
        }

        var handler = new JwtSecurityTokenHandler();

        try
        {
            var decoded = handler.ReadJwtToken(token);
            var now = DateTime.UtcNow;
            var skew = TimeSpan.FromMinutes(AppConstants.JwtClockSkewMinutes);

            // Check nbf/exp if present. (ReadJwtToken does not enforce these.)
            if (decoded.ValidFrom != DateTime.MinValue && decoded.ValidFrom - skew > now)
            {
                throw new Microsoft.IdentityModel.Tokens.SecurityTokenException("Token pas encore valide");
            }
            if (decoded.ValidTo != DateTime.MinValue && decoded.ValidTo + skew < now)
            {
                throw new Microsoft.IdentityModel.Tokens.SecurityTokenException("Token expiré");
            }

            return decoded;
        }
        catch (Exception ex)
        {
            throw new Microsoft.IdentityModel.Tokens.SecurityTokenException(
                $"Token invalide : {ex.Message}",
                ex);
        }
    }
}
