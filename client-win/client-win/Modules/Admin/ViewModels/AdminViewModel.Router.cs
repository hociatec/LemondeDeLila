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
                    PushReturnFocus();
                    await LoadCategoriesAsync(AdminPage.Root).ConfigureAwait(true);
                    return;
                }
                if (tag is string s && s == "games")
                {
                    PushReturnFocus();
                    await LoadGamesAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string bots && bots == "bots")
                {
                    PushReturnFocus();
                    await LoadBotsAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s2 && s2 == "users")
                {
                    PushReturnFocus();
                    await LoadUsersAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string chat && chat == "chat")
                {
                    PushReturnFocus();
                    await LoadChatAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s3 && s3 == "broadcast")
                {
                    PushReturnFocus();
                    BuildBroadcast();
                    return;
                }
                if (tag is string cu && cu == "clientUpdates")
                {
                    PushReturnFocus();
                    BuildClientUpdates();
                    return;
                }
                if (tag is string s4 && s4 == "rolesDefinitions")
                {
                    PushReturnFocus();
                    await LoadRoleDefinitionsAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string s5 && s5 == "logs")
                {
                    PushReturnFocus();
                    ShowLogs();
                    return;
                }
                if (tag is string maintenanceAction && maintenanceAction == "maintenance.deploy")
                {
                    await DeployBackendAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string perf && perf == "perf")
                {
                    PushReturnFocus();
                    await LoadPerfAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string maintenanceNav && maintenanceNav == "maintenance")
                {
                    PushReturnFocus();
                    BuildMaintenance();
                    return;
                }
                if (tag is string sounds && sounds == "sounds")
                {
                    PushReturnFocus();
                    BuildSounds();
                    return;
                }
                if (tag is string bugReports && bugReports == "bugReports")
                {
                    PushReturnFocus();
                    await LoadBugReportsAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string rooms && rooms == "rooms")
                {
                    PushReturnFocus();
                    BuildRooms();
                    return;
                }
            }

            if (_page == AdminPage.BugReports && tag is string bugListAction)
            {
                if (bugListAction == "bugReports.create")
                {
                    PushReturnFocus();
                    BuildBugReportCreate();
                    return;
                }
                if (bugListAction == "bugReports.list.pending")
                {
                    PushReturnFocus();
                    BuildBugReportsStatusReports(AdminBugReportStatus.Pending);
                    return;
                }
                if (bugListAction == "bugReports.list.in_progress")
                {
                    PushReturnFocus();
                    BuildBugReportsStatusReports(AdminBugReportStatus.InProgress);
                    return;
                }
                if (bugListAction == "bugReports.list.to_test")
                {
                    PushReturnFocus();
                    BuildBugReportsStatusReports(AdminBugReportStatus.ToTest);
                    return;
                }
                if (bugListAction == "bugReports.list.done")
                {
                    PushReturnFocus();
                    BuildBugReportsStatusReports(AdminBugReportStatus.Done);
                    return;
                }
                if (bugListAction == "bugReports.list.refused")
                {
                    PushReturnFocus();
                    BuildBugReportsStatusReports(AdminBugReportStatus.Refused);
                    return;
                }
            }

            if (_page == AdminPage.BugReportsStatusReports && tag is AdminBugReportDto reportFromStatus)
            {
                PushReturnFocus();
                BuildBugReportDetails(reportFromStatus);
                return;
            }

            if (_page == AdminPage.BugReports && tag is AdminBugReportDto report)
            {
                PushReturnFocus();
                BuildBugReportDetails(report);
                return;
            }

            if (_page == AdminPage.BugReportCreate && tag is string bugCreateAction && bugCreateAction == "bugReports.submit")
            {
                await SubmitBugReportAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.BugReportDetails && tag is string bugDetailsAction)
            {
                if (bugDetailsAction == "bugReports.edit" && _selectedBugReport != null)
                {
                    PushReturnFocus();
                    BuildBugReportEdit(_selectedBugReport);
                    return;
                }
                if (bugDetailsAction == "bugReports.consult" && _selectedBugReport != null)
                {
                    PushReturnFocus();
                    await LoadBugReportConsultAsync(_selectedBugReport).ConfigureAwait(true);
                    return;
                }
                if (bugDetailsAction == "bugReports.comments.add" && _selectedBugReport != null)
                {
                    PushReturnFocus();
                    BuildBugReportCommentCreate(_selectedBugReport);
                    return;
                }
                if (bugDetailsAction == "bugReports.delete")
                {
                    await DeleteBugReportAsync().ConfigureAwait(true);
                    return;
                }
                if (bugDetailsAction == "bugReports.status.pending")
                {
                    await UpdateBugReportStatusAsync("pending").ConfigureAwait(true);
                    return;
                }
                if (bugDetailsAction == "bugReports.status.in_progress")
                {
                    await UpdateBugReportStatusAsync("in_progress").ConfigureAwait(true);
                    return;
                }
                if (bugDetailsAction == "bugReports.status.done")
                {
                    await UpdateBugReportStatusAsync("done").ConfigureAwait(true);
                    return;
                }
                if (bugDetailsAction == "bugReports.status.to_test")
                {
                    await UpdateBugReportStatusAsync("to_test").ConfigureAwait(true);
                    return;
                }
                if (bugDetailsAction == "bugReports.status.refused")
                {
                    await UpdateBugReportStatusAsync("refused").ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.BugReportEdit && tag is string bugEditAction)
            {
                if (bugEditAction == "bugReports.edit.submit")
                {
                    await SubmitBugReportEditAsync().ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.BugReportComments && tag is string bugCommentsAction)
            {
                if (bugCommentsAction == "bugReports.comments.add" && _selectedBugReport != null)
                {
                    PushReturnFocus();
                    BuildBugReportCommentCreate(_selectedBugReport);
                    return;
                }
                if (bugCommentsAction == "bugReports.comments.refresh" && _selectedBugReport != null)
                {
                    await LoadBugReportCommentsAsync(_selectedBugReport).ConfigureAwait(true);
                    return;
                }
                if (bugCommentsAction == "bugReports.status.refused")
                {
                    await UpdateBugReportStatusAsync("refused").ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.BugReportCommentCreate && tag is string bugCommentCreateAction)
            {
                if (bugCommentCreateAction == "bugReports.comments.submit")
                {
                    await SubmitBugReportCommentAsync().ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.Rooms && tag is string roomsAction)
            {
                if (roomsAction == "rooms.cleanup.public")
                {
                    await CleanupPublicRoomsAsync().ConfigureAwait(true);
                    return;
                }
                if (roomsAction == "rooms.join.silent")
                {
                    await OpenRoomsJoinSilentAsync().ConfigureAwait(true);
                    return;
                }
                if (roomsAction == "rooms.destroy")
                {
                    await OpenRoomsDestroyAsync().ConfigureAwait(true);
                    return;
                }
                if (roomsAction == "rooms.settings.refresh")
                {
                    await RefreshRoomSettingsAsync().ConfigureAwait(true);
                    return;
                }
                if (roomsAction == "rooms.settings.toggle")
                {
                    await ToggleAutoCleanupAsync().ConfigureAwait(true);
                    return;
                }
                if (roomsAction == "rooms.settings.olderThan")
                {
                    PushReturnFocus();
                    var current = _roomSettings?.AutoCleanupOlderThanMinutes ?? 60;
                    BuildRoomsSettingEdit("Auto-cleanup", "Âge max (minutes)", current.ToString(), mode: "rooms.settings.olderThan");
                    return;
                }
                if (roomsAction == "rooms.settings.interval")
                {
                    PushReturnFocus();
                    var current = _roomSettings?.AutoCleanupIntervalSeconds ?? 300;
                    BuildRoomsSettingEdit("Auto-cleanup", "Interval (secondes)", current.ToString(), mode: "rooms.settings.interval");
                    return;
                }
                if (roomsAction == "rooms.settings.limit")
                {
                    PushReturnFocus();
                    var current = _roomSettings?.AutoCleanupLimit ?? 1000;
                    BuildRoomsSettingEdit("Auto-cleanup", "Limite (max rooms)", current.ToString(), mode: "rooms.settings.limit");
                    return;
                }
                if (roomsAction == "back")
                {
                    BuildRoot();
                    return;
                }
            }

            if (_page == AdminPage.EditText && tag is string submitRooms && submitRooms == "rooms.settings.submit")
            {
                await SubmitRoomsSettingEditAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.RoomsJoinSilent && tag is string joinTag)
            {
                const string prefix = "rooms.join.silent.open:";
                if (joinTag.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) &&
                    int.TryParse(joinTag.Substring(prefix.Length), out var roomId))
                {
                    await JoinSilentOpenSelectedAsync(roomId).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.RoomsDestroy && tag is string destroyTag)
            {
                const string prefix = "rooms.destroy.open:";
                if (destroyTag.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) &&
                    int.TryParse(destroyTag.Substring(prefix.Length), out var roomId))
                {
                    await DestroyRoomAsync(roomId).ConfigureAwait(true);
                    return;
                }
            }

            if (_page == AdminPage.Sounds && tag is string soundsTag)
            {
                if (soundsTag == "sounds.connection")
                {
                    PushReturnFocus();
                    BuildSoundsConnection();
                    return;
                }
                if (soundsTag == "sounds.ambience")
                {
                    PushReturnFocus();
                    BuildSoundsAmbience();
                    return;
                }
                if (soundsTag == "sounds.table")
                {
                    PushReturnFocus();
                    BuildSoundsTable();
                    return;
                }
                if (soundsTag == "sounds.invitations")
                {
                    PushReturnFocus();
                    BuildSoundsInvitations();
                    return;
                }
                if (soundsTag == "sounds.chat")
                {
                    PushReturnFocus();
                    BuildSoundsChat();
                    return;
                }
                if (soundsTag == "sounds.private")
                {
                    PushReturnFocus();
                    BuildSoundsPrivateMessages();
                    return;
                }
            }

            if (_page == AdminPage.SoundsAmbience && tag is string ambienceSound)
            {
                if (ambienceSound == "sounds.ambience.menu")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.MainMenuMusic);
                    return;
                }
                if (ambienceSound == "sounds.ambience.tavern")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.TavernAmbience);
                    return;
                }
            }

            if (_page == AdminPage.SoundsInvitations && tag is string inviteSound)
            {
                if (inviteSound == "sounds.friend.invite.sent" || inviteSound == "sounds.invite.sent")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.FriendInvitationSent);
                    return;
                }
                if (inviteSound == "sounds.friend.invite.received" || inviteSound == "sounds.invite.received")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.FriendInvitationReceived);
                    return;
                }
            }

            if (_page == AdminPage.SoundsConnection && tag is string connSound)
            {
                if (connSound == "sounds.client.opened")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.ClientOpened);
                    return;
                }
                if (connSound == "sounds.client.connected")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.ClientConnected);
                    return;
                }
                if (connSound == "sounds.client.disconnected")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.ClientDisconnected);
                    return;
                }
            }

            if (_page == AdminPage.SoundsTable && tag is string tableSound)
            {
                if (tableSound == "sounds.table.enter")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.RoomOpened);
                    return;
                }
                if (tableSound == "sounds.table.join")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.RoomJoined);
                    return;
                }
                if (tableSound == "sounds.table.exit")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.RoomExit);
                    return;
                }
                if (tableSound == "sounds.table.invite.sent")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.InvitationSent);
                    return;
                }
                if (tableSound == "sounds.table.invite.received")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.InvitationReceived);
                    return;
                }
            }

            if (_page == AdminPage.SoundsChat && tag is string chatSound)
            {
                if (chatSound == "sounds.chat.sent")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.ChatMessageSent);
                    return;
                }
                if (chatSound == "sounds.chat.received")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.ChatMessageReceived);
                    return;
                }
            }

            if (_page == AdminPage.SoundsPrivateMessages && tag is string pmSound)
            {
                if (pmSound == "sounds.private.sent")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.PrivateMessageSent);
                    return;
                }
                if (pmSound == "sounds.private.received")
                {
                    PushReturnFocus();
                    BuildSoundDetails(Modules.Audio.Models.SoundId.PrivateMessageReceived);
                    return;
                }
            }

            if (_page == AdminPage.SoundDetails && tag is string soundAction && _soundDetailsId.HasValue)
            {
                if (soundAction == "sound.preview")
                {
                    _sounds.Play(_soundDetailsId.Value);
                    return;
                }
                if (soundAction == "sound.change")
                {
                    await ChangeSoundAsync(_soundDetailsId.Value).ConfigureAwait(true);
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
                PushReturnFocus();
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
                    PushReturnFocus();
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

            if (_page == AdminPage.Users && tag is string usersTag && usersTag == "users.profile")
            {
                PushReturnFocus();
                BuildUsersProfileMenu();
                return;
            }

            if (_page == AdminPage.Users && tag is AdminUserDto user)
            {
                PushReturnFocus();
                BuildUserActions(user);
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

            if (_page == AdminPage.UserChatBanForm && _selectedUser != null && tag is string chatBanTag && chatBanTag == "userChatBan.submit")
            {
                await SubmitUserChatBanAsync(_selectedUser).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.UsersProfile && tag is string profileMenuTag && profileMenuTag == "users.profile.bio")
            {
                PushReturnFocus();
                await OpenProfileBioSettingsAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.UsersProfileBioSettings && tag is string profileTag && profileTag == "users.profile.submit")
            {
                await SubmitProfileSettingsAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Broadcast && tag is string sendTag && sendTag == "broadcast.send")
            {
                await SendBroadcastAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Chat)
            {
                if (tag is string t2 && t2 == "chat.clear")
                {
                    await ClearChatAsync().ConfigureAwait(true);
                    return;
                }
                if (tag is string tSettings && tSettings == "chat.settings.limit")
                {
                    PushReturnFocus();
                    BuildChatSettings();
                    return;
                }
                if (tag is ChatDayTag day)
                {
                    PushReturnFocus();
                    BuildChatDayMessages(day.DayLocalDate);
                    return;
                }
                if (tag is AdminChatMessageDto msg)
                {
                    PushReturnFocus();
                    BuildChatMessageActions(msg);
                    return;
                }
            }

            if (_page == AdminPage.ChatDay)
            {
                if (tag is AdminChatMessageDto msgDay)
                {
                    PushReturnFocus();
                    BuildChatMessageActions(msgDay);
                    return;
                }
            }

            if (_page == AdminPage.ChatMessageActions && _selectedChatMessage != null && tag is string chatAction)
            {
                if (chatAction == "chat.message.delete")
                {
                    await DeleteSelectedChatMessageAsync(_selectedChatMessage).ConfigureAwait(true);
                    return;
                }
                if (chatAction == "chat.user.ban")
                {
                    BuildChatBanForm(_selectedChatMessage);
                    return;
                }
                if (chatAction == "chat.user.unban")
                {
                    var uid = _selectedChatMessage.User?.Id ?? 0;
                    if (uid > 0)
                    {
                        await _admin.UnbanUserFromChatAsync(uid).ConfigureAwait(true);
                        await _dialogs.ShowInfo("Tchat", "Utilisateur débanni du tchat.").ConfigureAwait(true);
                        await ReloadChatModerationAsync().ConfigureAwait(true);
                    }
                    return;
                }
                if (chatAction == "chat.back")
                {
                    if (_chatReturnPage == AdminPage.ChatDay && _selectedChatDay.HasValue)
                    {
                        BuildChatDayMessages(_selectedChatDay.Value);
                    }
                    else
                    {
                        BuildChatDaysMenu();
                    }
                    return;
                }
            }

            if (_page == AdminPage.ChatBanForm && _selectedChatMessage != null && tag is string banSubmit && banSubmit == "chat.ban.submit")
            {
                await SubmitChatBanAsync(_selectedChatMessage).ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.ChatSettings && tag is string chatSettingsSubmit && chatSettingsSubmit == "chat.settings.submit")
            {
                await SubmitChatSettingsAsync().ConfigureAwait(true);
                return;
            }

            if (_page == AdminPage.Maintenance && tag is string maintenanceTag)
            {
                if (maintenanceTag == "maintenance.refresh")
                {
                    await RefreshMaintenanceAsync().ConfigureAwait(true);
                    return;
                }
                if (maintenanceTag == "maintenance.logs")
                {
                    await RefreshMaintenanceLogsAsync().ConfigureAwait(true);
                    return;
                }
                if (maintenanceTag == "maintenance.service.status")
                {
                    await RefreshMaintenanceServiceStatusAsync().ConfigureAwait(true);
                    return;
                }
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
            if (_page == AdminPage.ClientUpdates && tag is string forceTag && forceTag == "clientUpdate.forceLatest")
            {
                await ForceClientUpdateLatestAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.Logs && tag is string logTag && logTag == "logs.download")
            {
                await DownloadLogsAsync().ConfigureAwait(true);
                return;
            }
            if (_page == AdminPage.Perf && tag is string perfTag && perfTag == "perf.refresh")
            {
                await LoadPerfAsync().ConfigureAwait(true);
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
