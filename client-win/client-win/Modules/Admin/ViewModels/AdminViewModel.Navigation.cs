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
            // Return to chat list (jours) ou au jour sÃ©lectionnÃ©
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
        Items.Add(new AdminMenuItem("GÃ©rer les catÃ©gories", tag: "categories"));
        Items.Add(new AdminMenuItem("GÃ©rer les jeux", tag: "games"));
        Items.Add(new AdminMenuItem("GÃ©rer les bots", tag: "bots"));
        Items.Add(new AdminMenuItem("GÃ©rer les utilisateurs", tag: "users"));
        Items.Add(new AdminMenuItem("GÃ©rer les rooms", tag: "rooms"));
        Items.Add(new AdminMenuItem("Tchat (modÃ©ration)", tag: "chat"));
        Items.Add(new AdminMenuItem("Envoyer un message global", tag: "broadcast"));
        Items.Add(new AdminMenuItem("Mises Ã  jour client", tag: "clientUpdates"));
        Items.Add(new AdminMenuItem("GÃ©rer les rÃ´les", tag: "rolesDefinitions"));
        Items.Add(new AdminMenuItem("GÃ©rer les sons (application)", tag: "sounds"));
        Items.Add(new AdminMenuItem("Rapports de bug", tag: "bugReports"));
        Items.Add(new AdminMenuItem("Diagnostics latence (rooms/bots/parties)", tag: "perf"));
        Items.Add(new AdminMenuItem("Consulter les logs", tag: "logs"));
        Items.Add(new AdminMenuItem("Maintenance: dÃ©ployer/redÃ©marrer le backend", tag: "maintenance.deploy"));
        SelectedItem = Items.FirstOrDefault();
        Status = "EntrÃ©e : sÃ©lectionner. Ã‰chap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void UpdateFilterVisibility()
    {
        OnPropertyChanged(nameof(ShowUserFilters));
        OnPropertyChanged(nameof(ShowLogControls));
    }
}

