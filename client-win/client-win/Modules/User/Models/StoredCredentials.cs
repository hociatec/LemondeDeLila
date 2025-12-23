namespace client_win.Modules.User.Models;

/// <summary>
/// Modèle pour la persistance des credentials.
/// Le mot de passe est stocké sous forme de bytes (après chiffrement DPAPI) pour éviter
/// de garder des strings en texte clair en mémoire plus longtemps que nécessaire.
/// Ce modèle est utilisé uniquement pour la sérialisation avec chiffrement DPAPI.
/// </summary>
public sealed class StoredCredentials
{
    public StoredCredentials(string username, byte[] passwordBytes, bool rememberMe)
    {
        Username = username;
        PasswordBytes = passwordBytes;
        RememberMe = rememberMe;
    }

    public string Username { get; }

    /// <summary>
    /// Bytes du mot de passe (à chiffrer avec DPAPI avant stockage).
    /// Ne JAMAIS stocker en texte clair string.
    /// </summary>
    public byte[] PasswordBytes { get; }

    public bool RememberMe { get; }
}
