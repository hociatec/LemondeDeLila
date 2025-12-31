using System;
using System.Security;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using client_win.Core;
using client_win.Core.Constants;
using client_win.Modules.Network;
using client_win.Modules.User.Models;

namespace client_win.Modules.User.Services;

/// <summary>
/// Authentifie via le backend temps réel (/ws/api). La Home ne fait que relayer les réponses.
/// </summary>
public sealed class WsAuthenticationService : IAuthenticationService
{
    private readonly WsRequestClient _ws;
    private readonly Modules.Error.ErrorBus? _errorBus;
    private readonly JwtTokenValidator _validator;
    private readonly ILogger<WsAuthenticationService> _logger;

    public WsAuthenticationService(
        WsRequestClient ws,
        ILogger<WsAuthenticationService> logger,
        Modules.Error.ErrorBus? errorBus = null,
        JwtTokenValidator? validator = null)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _errorBus = errorBus;
        _validator = validator ?? new JwtTokenValidator();
    }

    public async Task<LoginResult> LoginAsync(string username, SecureString password, bool rememberMe)
    {
        _logger.LogInformation("Tentative de connexion pour l'utilisateur: {Username}, RememberMe: {RememberMe}", username, rememberMe);

        WsResponse<LoginResponsePayload> response;
        try
        {
            // SECURITY NOTE: SecureString must be converted to string for JSON serialization
            // The conversion happens here at the last possible moment before network transmission
            string passwordString = password?.ToUnsecureString() ?? string.Empty;
            response = await _ws.RequestAsync<LoginResponsePayload>(
                WsMessageTypes.Auth.Login,
                new { username, password = passwordString },
                token: null).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors de la tentative de connexion pour {Username}", username);
            _errorBus?.Publish(new Modules.Error.AppError("Connexion WS impossible.", Modules.Error.ErrorSeverity.Error, context: WsMessageTypes.ErrorContext.AuthLogin, detail: ex.Message));
            return LoginResult.Fail("La connexion a échoué.");
        }

        if (!response.Success || response.Payload == null || string.IsNullOrWhiteSpace(response.Payload.Token))
        {
            _logger.LogWarning("Échec de connexion pour {Username}: {Error}", username, response.Error);
            _errorBus?.Publish(new Modules.Error.AppError(response.Error ?? "La connexion a échoué.", Modules.Error.ErrorSeverity.Error, context: WsMessageTypes.ErrorContext.AuthLogin));
            return LoginResult.Fail(response.Error ?? "La connexion a échoué.");
        }

        var token = _validator.Validate(response.Payload.Token);
        string resolvedUsername = token.Payload.TryGetValue("username", out var u) ? u?.ToString() ?? username : username;
        int resolvedUserId = token.Payload.TryGetValue("id", out var idVal) && int.TryParse(idVal?.ToString(), out var uid) ? uid : 0;

        _logger.LogInformation("Connexion réussie pour {Username} (ID: {UserId})", resolvedUsername, resolvedUserId);
        return LoginResult.Ok(resolvedUsername, response.Payload.Token, resolvedUserId);
    }

    public async Task<RegistrationResult> RegisterAsync(string username, string email, SecureString password)
    {
        _logger.LogInformation("Tentative d'inscription pour {Username} avec email {Email}", username, email);

        WsResponse<RegisterResponsePayload> response;
        try
        {
            // SECURITY NOTE: SecureString must be converted to string for JSON serialization
            // The conversion happens here at the last possible moment before network transmission
            string passwordString = password?.ToUnsecureString() ?? string.Empty;
            response = await _ws.RequestAsync<RegisterResponsePayload>(
                WsMessageTypes.Auth.Register,
                new { username, email, password = passwordString },
                token: null).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors de l'inscription pour {Username}", username);
            _errorBus?.Publish(new Modules.Error.AppError("Inscription impossible (WS).", Modules.Error.ErrorSeverity.Error, context: WsMessageTypes.ErrorContext.AuthRegister, detail: ex.Message));
            return RegistrationResult.Fail("Inscription impossible.");
        }

        if (response.Success)
        {
            _logger.LogInformation("Inscription réussie pour {Username}", username);
            return RegistrationResult.Ok(username);
        }

        _logger.LogWarning("Échec d'inscription pour {Username}: {Error}", username, response.Error);
        _errorBus?.Publish(new Modules.Error.AppError(response.Error ?? "Inscription impossible.", Modules.Error.ErrorSeverity.Error, context: WsMessageTypes.ErrorContext.AuthRegister));
        return RegistrationResult.Fail(response.Error ?? "Inscription impossible.");
    }

    public async Task<bool> ValidateSessionAsync(AuthenticatedUser user)
    {
        if (user == null || string.IsNullOrWhiteSpace(user.Token))
        {
            return false;
        }

        int userId = user.UserId;
        if (userId <= 0)
        {
            try
            {
                var token = _validator.Validate(user.Token);
                userId = token.Payload.TryGetValue("id", out var idVal) && int.TryParse(idVal?.ToString(), out var uid) ? uid : 0;
            }
            catch
            {
                return false;
            }
        }
        if (userId <= 0)
        {
            return false;
        }

        var response = await _ws.RequestAsync<UserResponsePayload>(
            WsMessageTypes.Users.Get,
            new { id = userId },
            user.Token).ConfigureAwait(false);

        return response.Success && response.Payload?.User != null;
    }

    private sealed class LoginResponsePayload
    {
        public string? Token { get; set; }
    }

    private sealed class RegisterResponsePayload
    {
        public string? Message { get; set; }
    }

    private sealed class UserResponsePayload
    {
        public UserDto? User { get; set; }
    }

    private sealed class UserDto
    {
        public int Id { get; set; }
        public string? Username { get; set; }
    }
}
