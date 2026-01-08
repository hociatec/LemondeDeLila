using System;
using System.Linq;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    public AdminNavResult HandleEscape()
    {
        // Admin "Rooms" uses the generic EditText page for settings, so we need
        // to route Escape back to Rooms (not Games).
        if (_page == AdminPage.EditText &&
            !string.IsNullOrWhiteSpace(_currentEditMode) &&
            _currentEditMode.StartsWith("rooms.", StringComparison.OrdinalIgnoreCase))
        {
            BuildRooms();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Users && string.Equals(_userPickMode, "storybook", StringComparison.OrdinalIgnoreCase))
        {
            _userPickMode = null;
            BuildStoryBook();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.StoryBook)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.UserActions or AdminPage.BanForm or AdminPage.UsersProfile)
        {
            ShowUsers();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.UsersProfileBioSettings)
        {
            BuildUsersProfileMenu();
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

        if (_page == AdminPage.BugReports)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.BugReportsStatusReports)
        {
            BuildBugReports();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.BugReportConsult)
        {
            if (_selectedBugReport != null)
            {
                BuildBugReportDetails(_selectedBugReport);
            }
            else
            {
                BuildBugReports();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.BugReportEdit)
        {
            if (_selectedBugReport != null)
            {
                BuildBugReportDetails(_selectedBugReport);
            }
            else
            {
                BuildBugReports();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.BugReportComments)
        {
            if (_selectedBugReport != null)
            {
                BuildBugReportDetails(_selectedBugReport);
            }
            else
            {
                BuildBugReports();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.BugReportCommentCreate)
        {
            if (_selectedBugReport != null)
            {
                BuildBugReportDetails(_selectedBugReport);
            }
            else
            {
                BuildBugReports();
            }
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.BugReportCreate)
        {
            BuildBugReports();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.BugReportDetails)
        {
            if (_bugReportsListStatus.HasValue)
            {
                BuildBugReportsStatusReports(_bugReportsListStatus.Value);
            }
            else
            {
                BuildBugReports();
            }
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Rooms)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoomsJoinSilent)
        {
            BuildRooms();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.RoomsDestroy)
        {
            BuildRooms();
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

        if (_page is AdminPage.ChatSettings)
        {
            BuildChatDaysMenu();
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

        if (_page is AdminPage.MaintenanceBackend or AdminPage.MaintenanceSystemd)
        {
            BuildMaintenance();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.Games or AdminPage.Users or AdminPage.Broadcast or AdminPage.ClientUpdates or AdminPage.Maintenance)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.UserChatBanForm && _selectedUser != null)
        {
            BuildUserActions(_selectedUser);
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.Sounds)
        {
            BuildRoot();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.SoundsInvitations)
        {
            BuildSounds();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.SoundsConnection)
        {
            BuildSounds();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.SoundsTable)
        {
            BuildSounds();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.SoundsAmbience)
        {
            BuildSounds();
            return AdminNavResult.Moved;
        }

        if (_page is AdminPage.SoundsChat or AdminPage.SoundsPrivateMessages)
        {
            BuildSounds();
            return AdminNavResult.Moved;
        }

        if (_page == AdminPage.SoundDetails)
        {
            switch (_soundDetailsReturnPage)
            {
                case AdminPage.SoundsTable:
                    BuildSoundsTable();
                    break;
                case AdminPage.SoundsInvitations:
                    BuildSoundsInvitations();
                    break;
                case AdminPage.SoundsConnection:
                    BuildSoundsConnection();
                    break;
                case AdminPage.SoundsAmbience:
                    BuildSoundsAmbience();
                    break;
                case AdminPage.SoundsChat:
                    BuildSoundsChat();
                    break;
                case AdminPage.SoundsPrivateMessages:
                    BuildSoundsPrivateMessages();
                    break;
                default:
                    BuildSounds();
                    break;
            }
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
        Items.Add(new AdminMenuItem("Gérer les catégories", tag: "categories", category: "Jeux & Contenu"));
        Items.Add(new AdminMenuItem("Gérer les jeux", tag: "games", category: "Jeux & Contenu"));
        Items.Add(new AdminMenuItem("Gérer les bots", tag: "bots", category: "Jeux & Contenu"));
        Items.Add(new AdminMenuItem("Gérer les rooms", tag: "rooms", category: "Jeux & Contenu"));

        Items.Add(new AdminMenuItem("Gérer les utilisateurs", tag: "users", category: "Communauté"));
        Items.Add(new AdminMenuItem("Gérer les rôles", tag: "rolesDefinitions", category: "Communauté"));
        Items.Add(new AdminMenuItem("Livre des contes", tag: "storybook", category: "Communauté"));

        Items.Add(new AdminMenuItem("Tchat (modération)", tag: "chat", category: "Modération"));
        Items.Add(new AdminMenuItem("Envoyer un message global", tag: "broadcast", category: "Modération"));
        Items.Add(new AdminMenuItem("Notifications", tag: "notifications", category: "Modération"));
        Items.Add(new AdminMenuItem("Rapports de bug", tag: "bugReports", category: "Modération"));

        Items.Add(new AdminMenuItem("Mises à jour client", tag: "clientUpdates", category: "Système"));
        Items.Add(new AdminMenuItem("Gérer les sons (application)", tag: "sounds", category: "Système"));
        Items.Add(new AdminMenuItem("Diagnostics latence (rooms/bots/parties)", tag: "perf", category: "Système"));
        Items.Add(new AdminMenuItem("Consulter les logs", tag: "logs", category: "Système"));
        Items.Add(new AdminMenuItem("Maintenance (outils)", tag: "maintenance", category: "Système"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void UpdateFilterVisibility()
    {
        OnPropertyChanged(nameof(ShowUserFilters));
        OnPropertyChanged(nameof(ShowLogControls));
    }
}
