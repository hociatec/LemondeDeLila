using System;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task ActivateSelectedAsync()
    {
        if (IsBusy) return;
        var tag = SelectedItem?.Tag;
        if (tag == null) return;

        try
        {
            if (_page == AdminPage.Root)
            {
                if (tag is string rootCategories && rootCategories == "categories")
                {
                    await LoadCategoriesAsync(AdminPage.Root).ConfigureAwait(true);
                    return;
                }
                if (tag is string s && s == "games")
                {
                    await LoadGamesAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string bots && bots == "bots")
                {
                    await LoadBotsAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s2 && s2 == "users")
                {
                    await LoadUsersAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s3 && s3 == "broadcast")
                {
                    BuildBroadcast();
                    return;
                }
                if (tag is string cu && cu == "clientUpdates")
                {
                    BuildClientUpdates();
                    return;
                }
                if (tag is string s4 && s4 == "rolesDefinitions")
                {
                    await LoadRoleDefinitionsAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s5 && s5 == "logs")
                {
                    ShowLogs();
                    return;
                }
            }

            if (_page == AdminPage.Games && tag is string gamesAction && gamesAction == "games.categories")
            {
                await LoadCategoriesAsync(AdminPage.Games).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Games && tag is AdminGameDto game)
            {
                BuildGameActions(game);
                return;
            }

            if (_page == AdminPage.GameActions && tag is string gameAction)
            {
                if (gameAction == "game.category.assign")
                {
                    await LoadCategoryAssignmentMenuAsync().ConfigureAwait(true);
                    return;
                }
                if (_selectedGame != null)
                {
                    await ExecuteGameActionAsync(_selectedGame, gameAction).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.GameCategories)
            {
                if (tag is string categoryAction && categoryAction == "games.categories.create")
                {
                    BuildCategoryForm("create");
                    return;
                }
                if (tag is AdminGameCategoryDto category)
                {
                    BuildCategoryForm("edit", category);
                    return;
                }
            }

            if (_page == AdminPage.GameCategoryForm && tag is string categoryFormTag && categoryFormTag == "game.category.submit")
            {
                await SubmitCategoryFormAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.GameCategoryAssign)
            {
                if (tag is string assignTag && assignTag == "game.category.assign.none")
                {
                    await AssignCategoryToGameAsync(null).ConfigureAwait(true);
                    return;
                }
                if (tag is AdminGameCategoryDto category)
                {
                    await AssignCategoryToGameAsync(category.Id).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.Bots)
            {
                if (tag is string botsAction && botsAction == "bots.settings")
                {
                    BuildBotSettingsForm();
                    return;
                }
                if (tag is string createBot && createBot == "bots.create")
                {
                    BuildBotNameForm("create");
                    return;
                }
                if (tag is AdminBotNameDto botName)
                {
                    BuildBotNameActions(botName);
                    return;
                }
            }

            if (_page == AdminPage.BotNameActions && _selectedBotName != null && tag is string botAction)
            {
                await ExecuteBotNameActionAsync(_selectedBotName, botAction).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.BotNameForm && tag is string botFormTag && botFormTag == "bots.name.submit")
            {
                await SubmitBotNameFormAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.BotSettingsForm && tag is string botSettingsTag && botSettingsTag == "bots.settings.submit")
            {
                await SubmitBotSettingsFormAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.EditText && _selectedGame != null && tag is string editTag && editTag == "game.edit.submit")
            {
                await SubmitGameTextEditAsync(_selectedGame).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.EditPlayers && _selectedGame != null && tag is string editPlayersTag && editPlayersTag == "game.players.submit")
            {
                await SubmitGamePlayersAsync(_selectedGame).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Users && tag is AdminUserDto user)
            {
                BuildUserActions(user);
                return;
            }
            if (_page == AdminPage.Users && tag is string userTag && userTag == "filters")
            {
                ShowFilterReminder();
                return;
            }

            if (_page == AdminPage.UserActions && _selectedUser != null && tag is string act)
            {
                await ExecuteUserActionAsync(_selectedUser, act).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Roles && _selectedUser != null && tag is string role)
            {
                await ToggleRoleAsync(_selectedUser, role).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.BanForm && _selectedUser != null && tag is string banTag && banTag == "ban.submit")
            {
                await SubmitBanAsync(_selectedUser).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Broadcast && tag is string sendTag && sendTag == "broadcast.send")
            {
                await SendBroadcastAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.ClientUpdates && tag is string buildTag && buildTag == "clientUpdate.buildUpload")
            {
                await BuildAndUploadClientUpdateAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.ClientUpdates && tag is string updateTag && updateTag == "clientUpdate.announce")
            {
                await AnnounceClientUpdateAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.Logs && tag is string logTag && logTag == "logs.download")
            {
                await DownloadLogsAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.RoleDefinitions)
            {
                if (tag is string action && action == "roleDefinition.create")
                {
                    BuildRoleDefinitionForm("create");
                    return;
                }
                if (tag is AdminRoleDefinitionDto definition)
                {
                    BuildRoleDefinitionActions(definition);
                    return;
                }
            }

            if (_page == AdminPage.RoleDefinitionActions && _selectedRoleDefinition != null && tag is string roleAction)
            {
                if (roleAction == "roleDefinition.edit")
                {
                    BuildRoleDefinitionForm("edit", _selectedRoleDefinition);
                    return;
                }
                if (roleAction == "roleDefinition.delete")
                {
                    await DeleteRoleDefinitionAsync(_selectedRoleDefinition).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.RoleDefinitionForm && tag is string formTag && formTag == "roleDefinition.submit")
            {
                await SubmitRoleDefinitionFormAsync().ConfigureAwait(true);
                return;
            }
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Administration", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            NavigationChanged?.Invoke();
        }
    }
}
