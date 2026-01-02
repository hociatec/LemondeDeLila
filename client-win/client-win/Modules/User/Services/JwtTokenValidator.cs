using System;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using client_win.Modules.Config;
using client_win.Core.Constants;
using client_win.Core.Network;
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

    private static readonly object JwksGate = new();
    private static (RsaSecurityKey Key, DateTime CachedAtUtc)? _jwksCache;

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
            var jwksKey = TryGetSigningKeyFromJwks();
            if (jwksKey != null)
            {
                return ValidateWithKey(handler, token, jwksKey);
            }

            // In production/staging we fail closed: a missing public key would mean we cannot verify signatures.
            if (_environment != EnvironmentDetector.AppEnvironment.Development)
            {
                Log.Error("JWT signature verification is required but public key/JWKS is missing. Path={Path}", publicKeyPath ?? "(null)");
                throw new Microsoft.IdentityModel.Tokens.SecurityTokenException("Clé publique JWT manquante (signature non vérifiable)");
            }

            Log.Warning("JWT signature not verified (missing public key + JWKS). Development mode only. Path={Path}", publicKeyPath ?? "(null)");
            return DecodeAndValidateLifetimeOnly(handler, token);
        }

        var signingKey = CreateRsaPublicKeyFromPem(File.ReadAllText(publicKeyPath));

        return ValidateWithKey(handler, token, signingKey);
    }

    private JwtSecurityToken ValidateWithKey(JwtSecurityTokenHandler handler, string token, SecurityKey signingKey)
    {
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

    private static RsaSecurityKey CreateRsaPublicKeyFromPem(string pem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(pem);
        var parameters = rsa.ExportParameters(false);
        return new RsaSecurityKey(parameters);
    }

    private RsaSecurityKey? TryGetSigningKeyFromJwks()
    {
        if (_environment == EnvironmentDetector.AppEnvironment.Development)
        {
            // En dev, si la clé n'est pas packagée, on préfère garder le flux existant (mode permissif).
            return null;
        }

        lock (JwksGate)
        {
            if (_jwksCache.HasValue && DateTime.UtcNow - _jwksCache.Value.CachedAtUtc < TimeSpan.FromHours(6))
            {
                return _jwksCache.Value.Key;
            }
        }

        try
        {
            var jwksUris = new[]
            {
                // Non-standard alias (some reverse proxies block /.well-known/*).
                new Uri(_config.HttpBase, "jwks.json"),
                // If the reverse proxy strips /api before forwarding.
                new Uri(_config.HttpBase, "../jwks.json"),
                // Prefer /api/.well-known when HttpBase ends with /api/ and the reverse proxy only exposes /api/*
                new Uri(_config.HttpBase, ".well-known/jwks.json"),
                // Fallback to the standards path at the origin root.
                new Uri(_config.HttpBase, "../.well-known/jwks.json"),
            };

            RsaSecurityKey? key = null;
            foreach (var jwksUri in jwksUris)
            {
                try
                {
                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(6));
                    using var req = new HttpRequestMessage(HttpMethod.Get, jwksUri);
                    using var res = HttpClientProvider.Shared.SendAsync(req, cts.Token).GetAwaiter().GetResult();
                    res.EnsureSuccessStatusCode();
                    var json = res.Content.ReadAsStringAsync(cts.Token).GetAwaiter().GetResult();
                    var jwks = JsonSerializer.Deserialize<JwksDto>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    key = jwks?.GetFirstRsaKey();
                    if (key != null)
                    {
                        break;
                    }
                }
                catch (Exception ex)
                {
                    Log.Debug(ex, "JWKS fetch failed ({Uri})", jwksUri);
                }
            }

            if (key == null) return null;

            lock (JwksGate)
            {
                _jwksCache = (key, DateTime.UtcNow);
            }
            return key;
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "JWKS fetch failed; cannot verify JWT signature.");
            return null;
        }
    }

    private sealed class JwksDto
    {
        public JwkKeyDto[]? Keys { get; set; }

        public RsaSecurityKey? GetFirstRsaKey()
        {
            if (Keys == null || Keys.Length == 0)
            {
                return null;
            }

            foreach (var k in Keys)
            {
                if (k == null) continue;
                if (!string.Equals(k.Kty, "RSA", StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrWhiteSpace(k.Use) && !string.Equals(k.Use, "sig", StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrWhiteSpace(k.Alg) && !string.Equals(k.Alg, "RS256", StringComparison.OrdinalIgnoreCase)) continue;
                if (string.IsNullOrWhiteSpace(k.N) || string.IsNullOrWhiteSpace(k.E)) continue;

                var parameters = new RSAParameters
                {
                    Modulus = Base64UrlEncoder.DecodeBytes(k.N),
                    Exponent = Base64UrlEncoder.DecodeBytes(k.E),
                };

                // Important: use RSAParameters (not an RSA instance) so the key can't be disposed unexpectedly.
                var key = new RsaSecurityKey(parameters);
                if (!string.IsNullOrWhiteSpace(k.Kid))
                {
                    key.KeyId = k.Kid;
                }
                return key;
            }

            return null;
        }
    }

    private sealed class JwkKeyDto
    {
        public string? Kty { get; set; }
        public string? Use { get; set; }
        public string? Alg { get; set; }
        public string? Kid { get; set; }
        public string? N { get; set; }
        public string? E { get; set; }
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
