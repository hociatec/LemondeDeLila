using System;
using System.Runtime.InteropServices;
using System.Security;
using System.Text;

namespace client_win.Core;

/// <summary>
/// Extensions pour SecureString avec des méthodes de conversion sécurisées.
/// </summary>
public static class SecureStringExtensions
{
    /// <summary>
    /// Convertit SecureString en texte clair. À utiliser UNIQUEMENT au dernier moment avant transmission réseau.
    /// AVERTISSEMENT : Cette méthode expose les données sensibles en mémoire temporairement.
    /// </summary>
    public static string ToUnsecureString(this SecureString? secure)
    {
        if (secure == null) throw new ArgumentNullException(nameof(secure));
        IntPtr unmanagedString = IntPtr.Zero;
        try
        {
            unmanagedString = Marshal.SecureStringToGlobalAllocUnicode(secure);
            return Marshal.PtrToStringUni(unmanagedString) ?? string.Empty;
        }
        finally
        {
            Marshal.ZeroFreeGlobalAllocUnicode(unmanagedString);
        }
    }

    /// <summary>
    /// Convertit SecureString en bytes pour chiffrement avec DPAPI.
    /// Le tableau de bytes doit être immédiatement chiffré puis effacé de la mémoire.
    /// Cette méthode minimise le temps d'exposition du mot de passe en texte clair.
    /// </summary>
    public static byte[] ToEncryptableBytes(this SecureString? secure)
    {
        if (secure == null) throw new ArgumentNullException(nameof(secure));
        IntPtr unmanagedString = IntPtr.Zero;
        try
        {
            unmanagedString = Marshal.SecureStringToGlobalAllocUnicode(secure);
            string? text = Marshal.PtrToStringUni(unmanagedString);
            byte[] bytes = Encoding.UTF8.GetBytes(text ?? string.Empty);

            // Efface la string temporaire de la mémoire (best effort)
            // Note: Le GC peut avoir des copies, mais on fait de notre mieux
            text = string.Empty;

            return bytes;
        }
        finally
        {
            Marshal.ZeroFreeGlobalAllocUnicode(unmanagedString);
        }
    }

    /// <summary>
    /// Crée un SecureString depuis des bytes (après déchiffrement DPAPI).
    /// Les bytes doivent provenir d'un stockage chiffré (credentials.bin avec DPAPI).
    /// </summary>
    public static SecureString FromBytes(byte[] bytes)
    {
        if (bytes == null) throw new ArgumentNullException(nameof(bytes));

        string? text = Encoding.UTF8.GetString(bytes);
        var secure = new SecureString();

        foreach (char c in text)
        {
            secure.AppendChar(c);
        }

        secure.MakeReadOnly();

        // Efface la string temporaire de la mémoire (best effort)
        text = string.Empty;

        return secure;
    }
}
