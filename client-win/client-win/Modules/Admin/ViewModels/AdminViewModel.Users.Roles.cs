using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task BuildRolesEditorAsync(AdminUserDto user)
    {
        await EnsureRolesLoadedAsync().ConfigureAwait(true);
        _page = AdminPage.Roles;
        _selectedUser = user;
        _currentRoleSet = new HashSet<string>(user.Roles ?? new List<string>());
        Title = $"Rôles : {user.Username}";
        Details = "Sélectionnez un rôle, Entrée pour basculer.";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        RebuildRolesItems();
        UpdateFilterVisibility();
    }

    private void RebuildRolesItems()
    {
        Items.Clear();
        foreach (var role in _availableRoles)
        {
            var active = _currentRoleSet.Contains(role);
            var marker = active ? "✔" : " ";
            Items.Add(new AdminMenuItem($"{marker} {role}", tag: role));
        }
        if (Items.Count == 0)
        {
            Items.Add(new AdminMenuItem("Aucun rôle disponible."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : basculer. Échap : retour.";
    }

    private async Task ToggleRoleAsync(AdminUserDto user, string role)
    {
        if (!_availableRoles.Contains(role))
        {
            return;
        }
        var nextRoles = new HashSet<string>(_currentRoleSet);
        if (!nextRoles.Add(role))
        {
            nextRoles.Remove(role);
        }
        IsBusy = true;
        try
        {
            var updated = await _admin.UpdateUserRolesAsync(user.Id, nextRoles).ConfigureAwait(true);
            _selectedUser = updated;
            _currentRoleSet = new HashSet<string>(updated.Roles ?? new List<string>());
            _loadedUsers = _loadedUsers.Select(u => u.Id == updated.Id ? updated : u).ToArray();
            RebuildRolesItems();
            await _dialogs.ShowInfo("Rôles", $"Rôles mis à jour pour {user.Username}.").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task EnsureRolesLoadedAsync()
    {
        if (_availableRoles.Count > 0)
        {
            return;
        }
        var dto = await _admin.GetAvailableRolesAsync().ConfigureAwait(true);
        _availableRoles = dto.Roles ?? new List<string>();
    }
}
