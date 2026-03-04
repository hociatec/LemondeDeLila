using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Threading;
using client_win.Modules.Game.Common;
using client_win.Core.Text;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Services;

public sealed partial class GameHistorySink : IGameHistorySink
{
    private readonly Dispatcher _dispatcher;
    private readonly GameHistoryViewModel _history;
    private readonly IAnnouncementService? _announcements;
    private string? _lastMessage;
    private DateTime _lastMessageAtUtc;
    private string? _lastTurnMessageKey;
    private DateTime _lastTurnMessageAtUtc;
    private readonly List<(string Key, DateTime AtUtc)> _recentDedupe = new();
    private static readonly TimeSpan RecentDedupeWindow = GameTiming.History.RecentDedupeWindow;
    private static readonly TimeSpan StrongDedupeWindow = TimeSpan.FromMinutes(5);

    public GameHistorySink(Dispatcher dispatcher, GameHistoryViewModel history, IAnnouncementService? announcements = null)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _history = history ?? throw new ArgumentNullException(nameof(history));
        _announcements = announcements;
    }

    public void Add(string message, string? timestamp = null)
    {
        var parts = GameHistoryMessageSplitter.Split(message);
        if (parts.Count == 0)
        {
            return;
        }

        void AddNow()
        {
            foreach (var part in parts)
            {
                var raw = part ?? string.Empty;
                if (raw == GameHistoryMessageSplitter.BlankLineToken)
                {
                    _history.Entries.Add(raw);
                    continue;
                }

                var trimmed = raw.Trim();
                var isUi = trimmed.StartsWith("[ui]", StringComparison.OrdinalIgnoreCase);
                var isUiTurn = trimmed.StartsWith("[ui.turn]", StringComparison.OrdinalIgnoreCase);
                var isUiShortcutTagged = trimmed.StartsWith("[ui.shortcut]", StringComparison.OrdinalIgnoreCase);
                var isUiShortcut = isUi || isUiTurn || isUiShortcutTagged;
                var cleaned = RemoveInvisibleFormattingChars(StripGamePrefix(trimmed));
                if (MojibakeTextRepair.ShouldFix(cleaned))
                {
                    cleaned = MojibakeTextRepair.Fix(cleaned);
                }
                if (string.IsNullOrWhiteSpace(cleaned))
                {
                    continue;
                }

                // Les raccourcis utilisateur explicites ([ui.shortcut]) doivent toujours être rejoués
                // même si le texte est identique (ex: spam volontaire de "T" pour réécouter le tour).
                if (!isUiShortcutTagged && ShouldSkipDuplicate(cleaned))
                {
                    continue;
                }

                _history.Entries.Add(cleaned);

                TryAnnounce(
                    cleaned,
                    timestamp,
                    priority: isUiShortcut ? AnnouncementPriority.Assertive : AnnouncementPriority.Polite,
                    flushPending: isUi);
            }
        }

        // IMPORTANT:
        // Si on est déjà sur le thread UI (cas normal: update de game.state),
        // ajouter immédiatement pour préserver l'ordre des annonces (historique avant interface).
        if (_dispatcher.CheckAccess())
        {
            AddNow();
        }
        else
        {
            _dispatcher.InvokeAsync(AddNow, DispatcherPriority.Input);
        }
    }

    public void AddChat(string message)
    {
        // Le tchat doit rester sur une seule ligne (ne pas découper en phrases),
        // et éviter la double lecture NVDA (le contrôle d'historique suffit).
        var cleaned = NormalizeSingleLine(message);
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return;
        }

        void AddNow()
        {
            _history.Entries.Add(cleaned);
        }

        if (_dispatcher.CheckAccess())
        {
            AddNow();
        }
        else
        {
            _dispatcher.InvokeAsync(AddNow, DispatcherPriority.Input);
        }
    }

    private bool TryAnnounce(
        string message,
        string? timestamp,
        AnnouncementPriority priority,
        bool flushPending)
    {
        if (_announcements == null)
        {
            return false;
        }

        var normalized = NormalizeAnnouncement(message);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return false;
        }
        if (flushPending)
        {
            // When the user triggers an interface shortcut, prefer the related information immediately.
            // This avoids replaying stale queued announcements before the shortcut message.
            _announcements.CancelPending(cancelSpeech: false);
        }
        _announcements.Enqueue(normalized, priority);
        return true;
    }

}

