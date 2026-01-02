using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using client_win.Core.Constants;

namespace client_win.Modules.Admin.Services;

public sealed class AdminMaintenanceTokenStore : IAdminMaintenanceTokenStore
{
    private static string TokenPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "secrets",
            "admin-maintenance-token.bin");

    public bool HasToken()
    {
        return TryLoad() is { Length: > 0 };
    }

    public string? TryLoad()
    {
        try
        {
            if (!File.Exists(TokenPath))
            {
                return null;
            }

            var protectedBytes = File.ReadAllBytes(TokenPath);
            if (protectedBytes.Length == 0)
            {
                return null;
            }

            var bytes = ProtectedData.Unprotect(protectedBytes, optionalEntropy: null, scope: DataProtectionScope.CurrentUser);
            var token = Encoding.UTF8.GetString(bytes ?? Array.Empty<byte>()).Trim();
            return string.IsNullOrWhiteSpace(token) ? null : token;
        }
        catch
        {
            return null;
        }
    }

    public void Save(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ArgumentException("Token vide.", nameof(token));
        }

        Directory.CreateDirectory(Path.GetDirectoryName(TokenPath) ?? ".");
        var bytes = Encoding.UTF8.GetBytes(token.Trim());
        var protectedBytes = ProtectedData.Protect(bytes, optionalEntropy: null, scope: DataProtectionScope.CurrentUser);
        File.WriteAllBytes(TokenPath, protectedBytes);
    }

    public void Clear()
    {
        try
        {
            if (File.Exists(TokenPath))
            {
                File.Delete(TokenPath);
            }
        }
        catch
        {
            // ignore (best-effort)
        }
    }
}

