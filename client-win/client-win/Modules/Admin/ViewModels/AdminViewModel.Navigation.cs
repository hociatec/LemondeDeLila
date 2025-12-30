using System;
using System.Linq;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    public AdminNavResult HandleEscape()
    {
        if (_page is AdminPage.UserActions or AdminPage.BanForm)
        {
            ShowUsers();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.GameActions or AdminPage.EditText or AdminPage.EditPlayers)
        {
            ShowGames();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.GameCategoryAssign)
        {
            if (_selectedGame != null)
            {
                BuildGameActions(_selectedGame);
            }
            else
            {
                ShowGames();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.GameCategoryForm)
        {
            ShowCategories();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.GameCategories)
        {
            if (_categoriesReturnPage == AdminPage.Root)
            {
                BuildRoot();
            }
            else
            {
                ShowGames();
            }
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.BotNameActions or AdminPage.BotNameForm or AdminPage.BotSettingsForm)
        {
            ShowBots();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Bots)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Roles)
        {
            ShowUsers();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoleDefinitionForm)
        {
            if (string.Equals(_roleDefinitionFormMode, "edit", StringComparison.OrdinalIgnoreCase) && _selectedRoleDefinition != null)
            {
                BuildRoleDefinitionActions(_selectedRoleDefinition);
            }
            else
            {
                ShowRoleDefinitionsList();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoleDefinitionActions)
        {
            ShowRoleDefinitionsList();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoleDefinitions)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Perf)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Logs)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.Chat)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.ChatDay)
        {
            BuildChatDaysMenu();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.ChatMessageActions or AdminPage.ChatBanForm)
        {
            // Return to chat list (jours) ou au jour sélectionné
            if (_chatReturnPage == AdminPage.ChatDay && _selectedChatDay.HasValue)
            {
                BuildChatDayMessages(_selectedChatDay.Value);
            }
            else
            {
                BuildChatDaysMenu();
            }
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.ChatAccess or AdminPage.ChatAccessUserActions or AdminPage.ChatAccessBanForm)
        {
            _ = LoadChatAccessAsync();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.Games or AdminPage.Users or AdminPage.Broadcast or AdminPage.ClientUpdates)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        _close();
        return AdminNavResult.Closed;
    }

    private void BuildRoot()
    {
        _page = AdminPage.Root;
        Title = "Administration";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Gérer les catégories", tag: "categories"));
        Items.Add(new AdminMenuItem("Gérer les jeux", tag: "games"));
        Items.Add(new AdminMenuItem("Gérer les bots", tag: "bots"));
        Items.Add(new AdminMenuItem("Gérer les utilisateurs", tag: "users"));
        Items.Add(new AdminMenuItem("Tchat (modération)", tag: "chat"));
        Items.Add(new AdminMenuItem("Tchat (accès)", tag: "chatAccess"));
        Items.Add(new AdminMenuItem("Envoyer un message global", tag: "broadcast"));
        Items.Add(new AdminMenuItem("Mises à jour client", tag: "clientUpdates"));
        Items.Add(new AdminMenuItem("Gérer les rôles", tag: "rolesDefinitions"));
        Items.Add(new AdminMenuItem("Diagnostics latence (rooms/bots/parties)", tag: "perf"));
        Items.Add(new AdminMenuItem("Consulter les logs", tag: "logs"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
    }

    private void UpdateFilterVisibility()
    {
        OnPropertyChanged(nameof(ShowUserFilters));
        OnPropertyChanged(nameof(ShowLogControls));
    }
}
