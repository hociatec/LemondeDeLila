using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security;
using System.Text.RegularExpressions;

namespace client_win.Modules.Home.Services;

/// <summary>
/// Validateur centralisé pour les formulaires d'authentification.
/// Évite la duplication de la logique de validation entre LoginForm et RegisterForm.
/// </summary>
public static class AuthenticationValidator
{
    public const int MinUsernameLength = 3;
    public const int MaxUsernameLength = 30;
    public const int MinPasswordLength = 8;

    // Username: alphanumérique, tirets, underscores (pas de caractères spéciaux dangereux)
    private static readonly Regex UsernameRegex = new(@"^[a-zA-Z0-9_\-]+$", RegexOptions.Compiled);

    // Password: au moins une lettre et un chiffre pour sécurité basique
    private static readonly Regex PasswordHasLetterRegex = new(@"[a-zA-Z]", RegexOptions.Compiled);
    private static readonly Regex PasswordHasDigitRegex = new(@"[0-9]", RegexOptions.Compiled);

    /// <summary>
    /// Valide un nom d'utilisateur.
    /// </summary>
    /// <returns>Tuple (isValid, errorMessage) - errorMessage est null si valide.</returns>
    public static (bool isValid, string? errorMessage) ValidateUsername(string? username)
    {
        // Sanitization: trim et normalisation
        string trimmed = username?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return (false, "Le nom d'utilisateur est requis.");
        }

        if (trimmed.Length < MinUsernameLength)
        {
            return (false, $"Le nom d'utilisateur doit contenir au moins {MinUsernameLength} caractères.");
        }

        if (trimmed.Length > MaxUsernameLength)
        {
            return (false, $"Le nom d'utilisateur ne peut pas dépasser {MaxUsernameLength} caractères.");
        }

        // Validation format: alphanumérique, tirets, underscores uniquement
        if (!UsernameRegex.IsMatch(trimmed))
        {
            return (false, "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, tirets (-) et underscores (_).");
        }

        return (true, null);
    }

    /// <summary>
    /// Valide un mot de passe SecureString.
    /// NOTE: Validation de complexité limitée car SecureString ne permet pas l'inspection du contenu.
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
            return (false, $"Le mot de passe doit contenir au moins {MinPasswordLength} caractères (lettres et chiffres recommandés).");
        }

        // NOTE: Impossible de valider la complexité (lettres + chiffres) avec SecureString
        // La validation côté serveur doit être la source de vérité
        return (true, null);
    }

    /// <summary>
    /// Valide un mot de passe en texte clair (pour formulaires d'inscription).
    /// Vérifie la longueur et la complexité (lettres + chiffres).
    /// </summary>
    /// <returns>Tuple (isValid, errorMessage) - errorMessage est null si valide.</returns>
    public static (bool isValid, string? errorMessage) ValidatePasswordString(string? password)
    {
        // Sanitization: trim
        string trimmed = password?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return (false, "Le mot de passe est requis.");
        }

        if (trimmed.Length < MinPasswordLength)
        {
            return (false, $"Le mot de passe doit contenir au moins {MinPasswordLength} caractères.");
        }

        // Vérification complexité: au moins une lettre ET un chiffre
        bool hasLetter = PasswordHasLetterRegex.IsMatch(trimmed);
        bool hasDigit = PasswordHasDigitRegex.IsMatch(trimmed);

        if (!hasLetter || !hasDigit)
        {
            return (false, "Le mot de passe doit contenir au moins une lettre et un chiffre.");
        }

        return (true, null);
    }

    /// <summary>
    /// Valide une adresse email.
    /// </summary>
    /// <returns>Tuple (isValid, errorMessage) - errorMessage est null si valide.</returns>
    public static (bool isValid, string? errorMessage) ValidateEmail(string? email)
    {
        // Sanitization: trim et normalisation (lowercase pour emails)
        string trimmed = email?.Trim().ToLowerInvariant() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return (false, "L'adresse email est requise.");
        }

        // Limite de longueur raisonnable pour éviter abus
        if (trimmed.Length > 254) // RFC 5321
        {
            return (false, "L'adresse email est trop longue.");
        }

        // Utilise EmailAddressAttribute pour la validation du format
        var emailAttribute = new EmailAddressAttribute();
        if (!emailAttribute.IsValid(trimmed))
        {
            return (false, "L'adresse email n'est pas valide. Vérifiez le format (exemple: utilisateur@domaine.com).");
        }

        return (true, null);
    }
}
