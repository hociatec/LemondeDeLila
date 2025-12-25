using System;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;
using client_win.Modules.User.Models;
using Serilog;

namespace client_win.Modules.User.Services;

/// <summary>
/// Persistance RememberMe protégée via DPAPI (CurrentUser).
/// </summary>
public sealed class ProtectedCredentialStore : ICredentialStore
{
    private readonly string _filePath;

    public ProtectedCredentialStore()
    {
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string dir = Path.Combine(appData, "LeMondeDeLila");
        Directory.CreateDirectory(dir);
        _filePath = Path.Combine(dir, "credentials.bin");
    }

    public async Task SaveAsync(StoredCredentials credentials)
    {
        if (credentials == null) throw new ArgumentNullException(nameof(credentials));
        var payload = JsonSerializer.SerializeToUtf8Bytes(credentials);
        byte[] protectedBytes = ProtectedData.Protect(payload, null, DataProtectionScope.CurrentUser);
        await File.WriteAllBytesAsync(_filePath, protectedBytes).ConfigureAwait(false);
    }

    public async Task<StoredCredentials?> LoadAsync()
    {
        if (!File.Exists(_filePath))
        {
            return null;
        }
        try
        {
            byte[] protectedBytes = await File.ReadAllBytesAsync(_filePath).ConfigureAwait(false);
            byte[] data = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<StoredCredentials>(data);
        }
        catch (Exception ex)
        {
            // JUSTIFICATION: Erreurs attendues lors du chargement des credentials
            // Causes possibles: fichier corrompu, changement de profil utilisateur, modifications DPAPI
            // RECOVERY: Retourner null force une nouvelle authentification (comportement souhaité)
            // L'utilisateur devra simplement se reconnecter, ce qui est acceptable
            Log.Warning(ex, "Échec du chargement des credentials sauvegardées (le fichier sera ignoré)");
            return null;
        }
    }

    public Task ClearAsync()
    {
        if (File.Exists(_filePath))
        {
            try
            {
                File.Delete(_filePath);
            }
            catch (Exception ex)
            {
                // JUSTIFICATION: Échec de suppression non-critique
                // Causes possibles: fichier verrouillé, permissions changées
                // RECOVERY: Le fichier sera écrasé lors du prochain SaveAsync
                // Aucune action utilisateur requise
                Log.Warning(ex, "Échec de suppression du fichier credentials (sera écrasé au prochain SaveAsync)");
            }
        }
        return Task.CompletedTask;
    }
}
