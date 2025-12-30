using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminRoleDefinitionsResponseDto> ListRoleDefinitionsAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RolesDefinitionsList,
            payload: new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement des définitions impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminRoleDefinitionsResponseDto> CreateRoleDefinitionAsync(string name, string description, IEnumerable<string> permissions, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RoleDefinitionCreate,
            new { name, description, permissions = permissions ?? Array.Empty<string>() },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Création du rôle impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminRoleDefinitionsResponseDto> UpdateRoleDefinitionAsync(string name, string? newName, string? description, IEnumerable<string>? permissions, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var payload = new Dictionary<string, object?>
        {
            ["name"] = name,
        };
        if (!string.IsNullOrWhiteSpace(newName))
        {
            payload["newName"] = newName;
        }
        if (!string.IsNullOrWhiteSpace(description))
        {
            payload["description"] = description;
        }
        if (permissions != null)
        {
            payload["permissions"] = permissions;
        }

        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RoleDefinitionUpdate,
            payload,
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour du rôle impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminRoleDefinitionsResponseDto> DeleteRoleDefinitionAsync(string name, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RoleDefinitionDelete,
            new { name },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression du rôle impossible.");
        }
        return response.Payload;
    }
}

