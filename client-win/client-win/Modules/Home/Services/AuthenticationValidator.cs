using System.ComponentModel.DataAnnotations;
using System.Security;

namespace client_win.Modules.Home.Services;

/// <summary>
/// Validateur centralisé pour les formulaires d'authentification.
/// Évite la duplication de la logique de validation entre LoginForm et RegisterForm.
/// </summary>
public static class AuthenticationValidator
{
    public const int MinUsernameLength = 3;
    public const int MinPasswordLength = 6;

    /// <summary>
    /// Valide un nom d'utilisateur.
    /// </summary>
    /// <returns>Tuple (isValid, errorMessage) - errorMessage est null si valide.</returns>
    public static (bool isValid, string? errorMessage) ValidateUsername(string? username)
    {
        string trimmed = username?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return (false, "Le nom d'utilisateur est requis.");
        }

        if (trimmed.Length < MinUsernameLength)
        {
            return (false, $"Le nom d'utilisateur doit contenir au moins {MinUsernameLength} caractères.");
        }

        return (true, null);
    }

    /// <summary>
    /// Valide un mot de passe SecureString.
    /// </summary>
    /// <returns>Tuple (isValid, errorMessage) - errorMessage est null si valide.</returns>
    public static (bool isValid, string? errorMessage) ValidatePassword(SecureString? password)
    {
        if (password == null || password.Length == 0)
        {
            return (false, "Le mot de passe est requis.");
        }

        if (password.Length < MinPasswordLength)
        {
            return (false, $"Le mot de passe doit contenir au moins {MinPasswordLength} caractères.");
        }

        return (true, null);
    }

    /// <summary>
    /// Valide une adresse email.
    /// </summary>
    /// <returns>Tuple (isValid, errorMessage) - errorMessage est null si valide.</returns>
    public static (bool isValid, string? errorMessage) ValidateEmail(string? email)
    {
        string trimmed = email?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return (false, "L'adresse email est requise.");
        }

        // Utilise EmailAddressAttribute pour la validation du format
        var emailAttribute = new EmailAddressAttribute();
        if (!emailAttribute.IsValid(trimmed))
        {
            return (false, "L'adresse email n'est pas valide.");
        }

        return (true, null);
    }
}
