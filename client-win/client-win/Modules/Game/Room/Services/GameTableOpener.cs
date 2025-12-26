using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.Room.ViewModels;
using client_win.Modules.Game.Room.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class GameTableOpener : IGameTableOpener
{
    private readonly ILogger<GameTableOpener> _logger;
    private readonly IRoomGatewayClient _rooms;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialogs;
    private readonly IRoomAnnouncements _announcements;

    public GameTableOpener(
        ILogger<GameTableOpener> logger,
        IRoomGatewayClient rooms,
        INavigationService navigation,
        IDialogService dialogs,
        IRoomAnnouncements announcements)
    {
        _logger = logger;
        _rooms = rooms;
        _navigation = navigation;
        _dialogs = dialogs;
        _announcements = announcements;
    }

    public async Task OpenAsync(CatalogGame game, UserControl returnView)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));
        if (returnView == null) throw new ArgumentNullException(nameof(returnView));

        RoomSession session;
        try
        {
            _logger.LogInformation("Création de la table: gameType={GameType}", game.Id);
            session = await _rooms.CreateAndConnectAsync(game.Id).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur création table: gameType={GameType}", game.Id);
            await _dialogs.ShowError("Création de table", $"Impossible de créer la table : {ex.Message}").ConfigureAwait(true);
            return;
        }

        var tableView = new GameRoomView();

        var bots = new RoomBotCommands(session);
        var privacy = new RoomPrivacyCommands(session);
        var role = new RoomRoleCommands(session);
        Task AddBot() => bots.AddBotAsync();
        Task RemoveBot() => bots.RemoveLastBotAsync();
        Task AnnouncePlayers() => AnnouncePlayersAsync(session);
        Task TogglePrivacy() => privacy.TogglePrivacyAsync();
        Task ToggleRole() => role.ToggleRoleAsync();

        var tableVm = new GameRoomViewModel(
            game,
            onQuit: async () =>
        {
            try
            {
                bots.Dispose();
                privacy.Dispose();
                role.Dispose();
                await session.LeaveAsync().ConfigureAwait(true);
                await session.DisposeAsync().ConfigureAwait(true);
            }
            catch
            {
                // Best-effort; le backend ferme la table quand la dernière connexion sort.
            }

            _navigation.Show(returnView);
        },
            onAddBot: AddBot,
            onRemoveBot: RemoveBot,
            onAnnouncePlayers: AnnouncePlayers,
            onTogglePrivacy: TogglePrivacy,
            onToggleRole: ToggleRole,
            dialogs: _dialogs);

        tableVm.Status = $"Table créée (id {session.RoomId}).";

        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        bots.BotAdded += name =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : bot ajouté ({name})");
                tableVm.Status = $"Bot ajouté : {name}.";
                _announcements.BotJoined(name);
            }, DispatcherPriority.Background);
        };
        bots.BotRemoved += name =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : bot retiré ({name})");
                tableVm.Status = $"Bot retiré : {name}.";
                _announcements.BotLeft(name);
            }, DispatcherPriority.Background);
        };
        bots.ErrorReceived += message =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : erreur ({message})");
                tableVm.Status = $"Erreur : {message}";
                _announcements.Error(message);
            }, DispatcherPriority.Background);
        };

        privacy.PrivacyChanged += isPrivate =>
        {
            dispatcher.InvokeAsync(() =>
            {
                var label = isPrivate ? "privée" : "publique";
                tableVm.History.Entries.Add($"Serveur : table {label}");
                tableVm.Status = $"Visibilité : {label}.";
                _announcements.VisibilityChanged(isPrivate);
            }, DispatcherPriority.Background);
        };
        privacy.ErrorReceived += message =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : erreur ({message})");
                tableVm.Status = $"Erreur : {message}";
                _announcements.Error(message);
            }, DispatcherPriority.Background);
        };

        role.RoleChanged += isSpectator =>
        {
            dispatcher.InvokeAsync(() =>
            {
                var label = isSpectator ? "spectateur" : "joueur";
                tableVm.History.Entries.Add($"Serveur : mode {label}");
                tableVm.Status = $"Mode : {label}.";
                _announcements.RoleChanged(isSpectator);
            }, DispatcherPriority.Background);
        };
        role.ErrorReceived += message =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : erreur ({message})");
                tableVm.Status = $"Erreur : {message}";
                _announcements.Error(message);
            }, DispatcherPriority.Background);
        };

        var serverRoom = session.LastRoomState?.Room;
        if (serverRoom != null)
        {
            tableVm.History.Entries.Add($"Serveur : table créée (id {serverRoom.Id})");
            if (!string.IsNullOrWhiteSpace(serverRoom.Status))
            {
                tableVm.History.Entries.Add($"Statut serveur : {serverRoom.Status}");
            }
            if (!string.IsNullOrWhiteSpace(serverRoom.GameType))
            {
                tableVm.History.Entries.Add($"GameType : {serverRoom.GameType}");
            }
            tableVm.History.Entries.Add($"Privée : {(serverRoom.IsPrivate ? "oui" : "non")}");
            if (serverRoom.MaxPlayers > 0)
            {
                tableVm.History.Entries.Add($"Max joueurs : {serverRoom.MaxPlayers}");
            }
        }

        tableView.DataContext = tableVm;
        _navigation.Show(tableView);
    }

    private Task AnnouncePlayersAsync(RoomSession session)
    {
        _announcements.ShortcutKey("w");

        var room = session.LastRoomState?.Room;
        if (room == null)
        {
            _announcements.PlayersList("Table: informations indisponibles.");
            return Task.CompletedTask;
        }

        var humans = new List<string>();
        if (!string.IsNullOrWhiteSpace(room.Owner?.Username))
        {
            humans.Add(room.Owner.Username);
        }
        foreach (var p in room.Players ?? new List<RoomUserDto>())
        {
            if (!string.IsNullOrWhiteSpace(p.Username))
            {
                humans.Add(p.Username);
            }
        }
        humans = humans.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var bots = (room.Bots ?? new List<RoomBotDto>())
            .Select(b => b?.Name)
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Cast<string>()
            .ToList();

        if (humans.Count == 0 && bots.Count == 0)
        {
            _announcements.PlayersList("Aucun joueur dans la table.");
            return Task.CompletedTask;
        }

        var parts = new List<string>();
        if (humans.Count > 0)
        {
            parts.Add($"Joueurs: {string.Join(", ", humans)}");
        }
        if (bots.Count > 0)
        {
            parts.Add($"Bots: {string.Join(", ", bots)}");
        }
        _announcements.PlayersList(string.Join(". ", parts) + ".");
        return Task.CompletedTask;
    }
}
