using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task ApplyFiltersAsync()
    {
        if (!ShowUserFilters || IsBusy)
        {
            return;
        }
        await LoadUsersAsync().ConfigureAwait(true);
    }

    private async Task LoadUsersAsync(int? selectUserId = null)
    {
        if (IsBusy)
        {
            return;
        }

        var pickStoryBook = string.Equals(_userPickMode, "storybook", StringComparison.OrdinalIgnoreCase);

        _page = AdminPage.Users;
        Title = pickStoryBook ? "Livre des contes — choisir un utilisateur" : "Gestion des utilisateurs";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
        IsBusy = true;
        try
        {
            var search = string.IsNullOrWhiteSpace(FilterSearch) ? null : FilterSearch.Trim();
            var role = string.IsNullOrWhiteSpace(FilterRole) ? null : FilterRole.Trim();
            var status = string.Equals(FilterStatus, "all", StringComparison.OrdinalIgnoreCase) ? null : FilterStatus;

            string? after = null;
            if (!string.IsNullOrWhiteSpace(FilterCreatedAfter))
            {
                if (!DateTime.TryParse(FilterCreatedAfter, out var parsedAfter))
                {
                    await _dialogs.ShowError("Filtres", "Date « créé après » invalide.").ConfigureAwait(true);
                    return;
                }
                after = parsedAfter.ToString("o");
            }

            string? before = null;
            if (!string.IsNullOrWhiteSpace(FilterCreatedBefore))
            {
                if (!DateTime.TryParse(FilterCreatedBefore, out var parsedBefore))
                {
                    await _dialogs.ShowError("Filtres", "Date « créé avant » invalide.").ConfigureAwait(true);
                    return;
                }
                before = parsedBefore.ToString("o");
            }

            var res = await _admin.ListUsersAsync(
                    search: search,
                    role: role,
                    status: status,
                    createdAfter: after,
                    createdBefore: before,
                    page: 1,
                    limit: 50)
                .ConfigureAwait(true);

            _loadedUsers = (res.Items ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                Items.Clear();
                if (!pickStoryBook)
                {
                    Items.Add(new AdminMenuItem("Gestion profil", tag: "users.profile"));
                    Items.Add(new AdminMenuItem("—", tag: "separator"));
                }
                foreach (var user in _loadedUsers.OrderBy(u => u.Username))
                {
                    var roles = user.Roles != null && user.Roles.Count > 0 ? string.Join(',', user.Roles) : "ROLE_USER";
                    var banned = IsUserBanActiveNow(user)
                        ? $"Banni (jusqu'au {user.BannedUntil:dd/MM/yyyy})"
                        : HasUserBanMarker(user) ? "Ban expiré" : "Actif";
                    Items.Add(new AdminMenuItem($"{user.Username} (id {user.Id}) - {roles} - {banned}", tag: user));
                }
                if (_loadedUsers.Length == 0)
                {
                    Items.Add(new AdminMenuItem("Aucun utilisateur."));
                }
                SelectedItem = selectUserId.HasValue
                    ? Items.FirstOrDefault(i => i.Tag is AdminUserDto u && u.Id == selectUserId.Value) ?? Items.FirstOrDefault()
                    : Items.FirstOrDefault();
                Status = pickStoryBook
                    ? $"Affichage {Math.Min(_loadedUsers.Length, res.Total)} / {res.Total} utilisateurs. Entrée : ouvrir. Échap : retour."
                    : $"Affichage {Math.Min(_loadedUsers.Length, res.Total)} / {res.Total} utilisateurs. Entrée : actions. Échap : retour.";
                UpdateFilterVisibility();
                RestoreFocusIfAny();
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowUsers()
    {
        _page = AdminPage.Users;
        Title = "Gestion des utilisateurs";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Gestion profil", tag: "users.profile"));
        Items.Add(new AdminMenuItem("—", tag: "separator"));
        foreach (var user in _loadedUsers.OrderBy(u => u.Username))
        {
            var roles = user.Roles != null && user.Roles.Count > 0 ? string.Join(',', user.Roles) : "ROLE_USER";
            var banned = IsUserBanActiveNow(user)
                ? $"Banni (jusqu'au {user.BannedUntil:dd/MM/yyyy})"
                : HasUserBanMarker(user) ? "Ban expiré" : "Actif";
            Items.Add(new AdminMenuItem($"{user.Username} (id {user.Id}) - {roles} - {banned}", tag: user));
        }
        if (_loadedUsers.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun utilisateur."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : actions. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }
}
