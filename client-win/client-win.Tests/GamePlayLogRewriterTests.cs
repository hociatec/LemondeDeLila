using System.Collections.Generic;
using System.Linq;
using System.Windows.Threading;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Game.Play.GamePlay.Services;
using client_win.Modules.Shell.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayLogRewriterTests
{
    [Fact]
    public void RewriteForViewer_DrawWithoutCardName_InfersSingleAddedCard()
    {
        var previous = new Dictionary<string, int> { ["Croquettes"] = 0 };
        var current = new Dictionary<string, int> { ["Croquettes"] = 1 };

        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene pioche.",
            viewerUsername: "Hacene",
            previousHandCounts: previous,
            currentHandCounts: current);

        Assert.Equal("Vous piochez un Croquettes.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_DrawWithCardName_UsesServerRemainder()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene pioche Croquettes.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous piochez Croquettes.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_OpponentDraw_IsNotRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Bucky pioche une carte.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Bucky pioche une carte.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_PlayCardWithoutArticle_IsRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene joue Croquettes.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous jouez Croquettes.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_PlayCardWithArticle_IsRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene joue un 1.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous jouez un 1.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_Discard_IsRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene défausse Croquettes.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous défaussez Croquettes.", rewritten);
    }

    [Fact]
    public void GameHistorySink_ReplaysEveryLineOfRepeatedUiShortcutMessage()
    {
        var announcements = new RecordingAnnouncementService();
        var history = new GameHistoryViewModel(new CatalogGame
        {
            Id = "cat-pattes",
            Name = "Cat Pattes",
            Summary = "Test",
            MinPlayers = 2,
            MaxPlayers = 4,
            Engine = "plateau",
        });
        var sink = new GameHistorySink(
            Dispatcher.CurrentDispatcher,
            history,
            announcements);

        const string message =
            "[ui.shortcut] Hacene : libre.\nLilas : arrêtée par Gamelle vide.";

        sink.Add(message);
        sink.Add(message);

        Assert.Equal(
            new[]
            {
                "Hacene : libre.",
                "Lilas : arrêtée par Gamelle vide.",
                "Hacene : libre.",
                "Lilas : arrêtée par Gamelle vide.",
            },
            history.Entries.ToArray());

        Assert.Equal(2, announcements.CancelPendingCalls);
        Assert.Equal(
            new[]
            {
                ("Hacene : libre. Lilas : arrêtée par Gamelle vide.", AnnouncementPriority.Assertive),
                ("Hacene : libre. Lilas : arrêtée par Gamelle vide.", AnnouncementPriority.Assertive),
            },
            announcements.Messages.ToArray());
    }

    [Fact]
    public void GameHistorySink_SkipsRegularTurnAnnouncementDuringPawnSetup()
    {
        var announcements = new RecordingAnnouncementService();
        var history = new GameHistoryViewModel(new CatalogGame
        {
            Id = "a-fond-les-ballons",
            Name = "A fond les ballons",
            Summary = "Test",
            MinPlayers = 2,
            MaxPlayers = 4,
            Engine = "plateau",
        });
        var sink = new GameHistorySink(
            Dispatcher.CurrentDispatcher,
            history,
            announcements);

        sink.Add("C'est à hacene de choisir son pion.");
        sink.Add("C'est au tour de hacene.");
        sink.Add("hacene a choisi le pion: Capitaine Cacahuète.");

        Assert.Equal(
            new[]
            {
                "C'est à hacene de choisir son pion.",
                "hacene a choisi le pion: Capitaine Cacahuète.",
            },
            history.Entries.ToArray());
    }

    [Fact]
    public void GameHistorySink_KeepsStarterAnnouncementAfterPawnSetup()
    {
        var announcements = new RecordingAnnouncementService();
        var history = new GameHistoryViewModel(new CatalogGame
        {
            Id = "a-fond-les-ballons",
            Name = "A fond les ballons",
            Summary = "Test",
            MinPlayers = 2,
            MaxPlayers = 4,
            Engine = "plateau",
        });
        var sink = new GameHistorySink(
            Dispatcher.CurrentDispatcher,
            history,
            announcements);

        sink.Add("C'est à hacene de choisir son pion.");
        sink.Add("hacene a choisi le pion: Capitaine Cacahuète.");
        sink.Add("C'est à Karaba de choisir son pion.");
        sink.Add("Karaba a choisi le pion: Hamstero Dynamite.");
        sink.Add("C'est au tour de hacene de débuter.");

        Assert.Equal(
            new[]
            {
                "C'est à hacene de choisir son pion.",
                "hacene a choisi le pion: Capitaine Cacahuète.",
                "C'est à Karaba de choisir son pion.",
                "Karaba a choisi le pion: Hamstero Dynamite.",
                "C'est au tour de hacene de débuter.",
            },
            history.Entries.ToArray());
    }

    private sealed class RecordingAnnouncementService : IAnnouncementService
    {
        public List<(string Message, AnnouncementPriority Priority)> Messages { get; } = new();

        public int CancelPendingCalls { get; private set; }

        public bool IsAvailable => true;

        public void Enqueue(string message, AnnouncementPriority priority = AnnouncementPriority.Polite)
        {
            Messages.Add((message, priority));
        }

        public void EnqueueMany(IEnumerable<string> messages, AnnouncementPriority priority = AnnouncementPriority.Polite)
        {
            foreach (var message in messages ?? Enumerable.Empty<string>())
            {
                Enqueue(message, priority);
            }
        }

        public void CancelPending(bool cancelSpeech = false)
        {
            CancelPendingCalls++;
        }

        public void NotifyUserInteraction() { }

        public void SetGameplayUltraReactive(bool enabled) { }
    }
}
