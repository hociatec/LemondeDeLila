using System;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Security.Cryptography;
using client_win.Modules.Config;
using client_win.Core.Constants;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace client_win.Modules.User.Services;

/// <summary>
/// Valide un token JWT.
/// IMPORTANT: le client ne doit jamais embarquer un secret de signature (HS256). On utilise RS256 + clé publique.
/// </summary>
public sealed class JwtTokenValidator
{
    private readonly ClientConfiguration _config;
    private readonly EnvironmentDetector.AppEnvironment _environment;

    public JwtTokenValidator(ClientConfiguration config)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _environment = EnvironmentDetector.GetEnvironment();
    }

    public JwtSecurityToken Validate(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new Microsoft.IdentityModel.Tokens.SecurityTokenException("Token manquant");
        }

        try
        {
            return ValidateInternal(token);
        }
        catch (Exception ex)
        {
            throw new Microsoft.IdentityModel.Tokens.SecurityTokenException(
                $"Token invalide : {ex.Message}",
                ex);
        }
    }

    private JwtSecurityToken ValidateInternal(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        var publicKeyPath = _config.JwtSignaturePublicKeyPath;

        if (string.IsNullOrWhiteSpace(publicKeyPath) || !File.Exists(publicKeyPath))
        {
            // In production/staging we fail closed: a missing public key would mean we cannot verify signatures.
            if (_environment != EnvironmentDetector.AppEnvironment.Development)
            {
                Log.Error("JWT signature verification is required but public key is missing. Path={Path}", publicKeyPath ?? "(null)");
                throw new Microsoft.IdentityModel.Tokens.SecurityTokenException("Clé publique JWT manquante (signature non vérifiable)");
            }

            Log.Warning("JWT signature not verified (missing public key). Development mode only. Path={Path}", publicKeyPath ?? "(null)");
            return DecodeAndValidateLifetimeOnly(handler, token);
        }

        using var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(publicKeyPath));
        var signingKey = new RsaSecurityKey(rsa);

        var parameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(AppConstants.JwtClockSkewMinutes),
            ValidIssuer = _config.JwtIssuer,
            ValidateIssuer = !string.IsNullOrWhiteSpace(_config.JwtIssuer),
            ValidAudience = _config.JwtAudience,
            ValidateAudience = !string.IsNullOrWhiteSpace(_config.JwtAudience),
            ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 }
        };

        _ = handler.ValidateToken(token, parameters, out var validatedToken);
        if (validatedToken is not JwtSecurityToken jwt)
        {
            throw new Microsoft.IdentityModel.Tokens.SecurityTokenException("Token invalide");
        }
        return jwt;
    }

    private static JwtSecurityToken DecodeAndValidateLifetimeOnly(JwtSecurityTokenHandler handler, string token)
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
}
