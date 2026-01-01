using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminProfileSettingsDto> GetProfileSettingsAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminProfileSettingsDto>(
            WsMessageTypes.Admin.ProfileSettingsGet,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Lecture des paramètres profil impossible.");
        }

        return res.Payload;
    }

    public async Task<AdminProfileSettingsDto> UpdateProfileSettingsAsync(
        int? bioMinLength = null,
        int? bioMaxLength = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminProfileSettingsDto>(
            WsMessageTypes.Admin.ProfileSettingsUpdate,
            new { bioMinLength, bioMaxLength },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Mise à jour des paramètres profil impossible.");
        }

        return res.Payload;
    }
}

