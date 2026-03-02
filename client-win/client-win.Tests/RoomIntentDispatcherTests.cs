using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Shell.Services;
using Xunit;

namespace client_win.Tests;

public sealed class RoomIntentDispatcherTests
{
    [Fact]
    public void StartWizardIntent_UsesMessage_ForStatusAndHistory()
    {
        var vm = CreateViewModel();
        var history = new MemoryHistorySink();
        var roomAnnouncements = new NoopRoomAnnouncements();

        var dispatcher = CreateDispatcher(vm, history, roomAnnouncements);

        using var doc = JsonDocument.Parse(
            "{\"type\":\"start-wizard\",\"payload\":{\"message\":\"Choisissez rapidement l ambiance.\"}}");
        HandleIntent(dispatcher, doc.RootElement);

        Assert.Equal("Choisissez rapidement l ambiance.", vm.Status);
        Assert.Contains("Choisissez rapidement l ambiance.", history.Messages);
    }

    [Fact]
    public void StartWizardIntent_BuildsMessageFromTitleAndDescription()
    {
        var vm = CreateViewModel();
        var history = new MemoryHistorySink();
        var roomAnnouncements = new NoopRoomAnnouncements();

        var dispatcher = CreateDispatcher(vm, history, roomAnnouncements);

        using var doc = JsonDocument.Parse(
            "{\"type\":\"start-wizard\",\"payload\":{\"title\":\"Configuration de la table\",\"description\":\"Le serveur vous invite a preparer la partie.\"}}");
        HandleIntent(dispatcher, doc.RootElement);

        Assert.Equal(
            "Configuration de la table. Le serveur vous invite a preparer la partie.",
            vm.Status);
        Assert.Contains(
            "Configuration de la table. Le serveur vous invite a preparer la partie.",
            history.Messages);
    }

    private static object CreateDispatcher(
        GameRoomViewModel vm,
        IGameHistorySink history,
        IRoomAnnouncements announcements)
    {
        var type = typeof(GameRoomViewModel).Assembly.GetType(
            "client_win.Modules.Game.Shell.Services.RoomIntentDispatcher",
            throwOnError: true);
        Assert.NotNull(type);

        var instance = Activator.CreateInstance(
            type!,
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
            binder: null,
            args: new object[] { vm, history, announcements },
            culture: null);

        Assert.NotNull(instance);
        return instance!;
    }

    private static void HandleIntent(object dispatcher, JsonElement payload)
    {
        var method = dispatcher.GetType().GetMethod(
            "HandleIntent",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        Assert.NotNull(method);
        method!.Invoke(dispatcher, new object[] { payload });
    }

    private static GameRoomViewModel CreateViewModel()
    {
        static Task Done() => Task.CompletedTask;

        return new GameRoomViewModel(
            game: new CatalogGame
            {
                Id = "lama",
                Name = "Lama",
                Summary = "Test",
                MinPlayers = 2,
                MaxPlayers = 6,
                Engine = "plateau",
                ChatEnabled = true,
                ChatSoundsEnabled = true,
            },
            onSendChat: _ => Task.CompletedTask,
            onShowRules: Done,
            onConfigureTableAmbience: Done,
            onConfigureTableAmbienceVolume: Done,
            onStart: Done,
            onSaveSnapshot: Done,
            onReset: Done,
            onQuit: Done,
            onAddBot: Done,
            onRemoveBot: Done,
            onAnnouncePlayers: Done,
            onAnnounceInfo: Done,
            onTogglePrivacy: Done,
            onToggleRole: Done,
            onInvite: Done,
            onKick: Done,
            onBan: Done,
            onTransferOwner: Done,
            dialogs: new NoopDialogService(),
            focusCoordinator: new NoopFocusCoordinator(),
            screenReader: new NoopScreenReaderAnnouncer(),
            announcements: new NoopAnnouncementService());
    }

    private sealed class MemoryHistorySink : IGameHistorySink
    {
        public List<string> Messages { get; } = new();

        public void Add(string message, string? timestamp = null)
        {
            Messages.Add(message ?? string.Empty);
        }

        public void AddChat(string message)
        {
            Messages.Add(message ?? string.Empty);
        }
    }

    private sealed class NoopRoomAnnouncements : IRoomAnnouncements
    {
        public event Action<RoomAnnouncement>? Announced;

        public void Publish(RoomAnnouncement announcement)
        {
            Announced?.Invoke(announcement);
        }

        public void BotJoined(string botName) { }
        public void BotLeft(string botName) { }
        public void PlayerJoined(string username, bool spectator) { }
        public void PlayerLeft(string username, bool spectator) { }
        public void OwnerChanged(string username) { }
        public void PlayersList(string message) { }
        public void TableInfo(string message) { }
        public void VisibilityChanged(bool isPrivate) { }
        public void RoleChanged(bool isSpectator) { }
        public void Error(string message) { }
    }

    private sealed class NoopFocusCoordinator : IGameFocusCoordinator
    {
        private sealed class EmptyDisposable : IDisposable
        {
            public void Dispose() { }
        }

        public IDisposable AttachHost(IGameFocusHost host) => new EmptyDisposable();
        public void RequestGameZone(GameFocusReason reason = GameFocusReason.Default) { }
        public void CancelPendingRequests() { }
    }

    private sealed class NoopDialogService : IDialogService
    {
        public Task ShowError(string title, string message) => Task.CompletedTask;
        public Task ShowInfo(string title, string message) => Task.CompletedTask;
        public Task<bool?> Confirm(string title, string message, string? okText = null, string? cancelText = null) => Task.FromResult<bool?>(true);
        public Task<DialogChoice?> Choose(string title, string message, string primaryText, string secondaryText, string cancelText) => Task.FromResult<DialogChoice?>(DialogChoice.Primary);
        public Task<string?> Pick(string title, string message, IReadOnlyList<string> options, string? okText = null, string? cancelText = null) => Task.FromResult<string?>(options.Count > 0 ? options[0] : null);
    }

    private sealed class NoopScreenReaderAnnouncer : IScreenReaderAnnouncer
    {
        public bool IsRunning => false;
        public void AnnouncePolite(string message) { }
        public void AnnounceAssertive(string message) { }
        public void AnnounceAssertiveEvenIfInactive(string message) { }
        public void CancelSpeech() { }
    }

    private sealed class NoopAnnouncementService : IAnnouncementService
    {
        public bool IsAvailable => false;
        public void Enqueue(string message, AnnouncementPriority priority = AnnouncementPriority.Polite) { }
        public void EnqueueMany(IEnumerable<string> messages, AnnouncementPriority priority = AnnouncementPriority.Polite) { }
        public void CancelPending(bool cancelSpeech = false) { }
        public void NotifyUserInteraction() { }
        public void SetGameplayUltraReactive(bool enabled) { }
    }
}

