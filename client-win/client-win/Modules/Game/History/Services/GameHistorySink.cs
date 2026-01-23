using System;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Services;

public sealed class GameHistorySink : IGameHistorySink
{
    private readonly Dispatcher _dispatcher;
    private readonly GameHistoryViewModel _history;
    private readonly IAnnouncementService? _announcements;

    public GameHistorySink(Dispatcher dispatcher, GameHistoryViewModel history, IAnnouncementService? announcements = null)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _history = history ?? throw new ArgumentNullException(nameof(history));
        _announcements = announcements;
    }

    public void Add(string message)
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
                var cleaned = StripGamePrefix((part ?? string.Empty).Trim());
                if (string.IsNullOrWhiteSpace(cleaned))
                {
                    continue;
                }

                _history.Entries.Add(cleaned);

                // Robustesse lecteur d'écran: annoncer explicitement chaque ligne.
                // On séquence avec un petit espacement pour éviter que NVDA "avale" des lignes lors d'une rafale.
                _announcements?.Enqueue(cleaned, AnnouncementPriority.Polite);
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
            _dispatcher.InvokeAsync(AddNow, DispatcherPriority.Background);
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
            _dispatcher.InvokeAsync(AddNow, DispatcherPriority.Background);
        }
    }

    private static string NormalizeSingleLine(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        var normalized = (message ?? string.Empty)
            .Replace("\r\n", " ", StringComparison.Ordinal)
            .Replace('\r', ' ')
            .Replace('\n', ' ')
            .Trim();

        // Collapse whitespace to avoid weird wraps (NBSP, multiple spaces).
        var parts = normalized
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 0 ? string.Empty : string.Join(' ', parts);
    }

    private static string StripGamePrefix(string message)
    {
        if (string.IsNullOrWhiteSpace(message) || message.Length < 4)
        {
            return message;
        }

        // Beaucoup de jeux préfixent leurs logs pour debug : "[Panier Express] ...".
        // Pour l'accessibilité (annonces), on retire ce préfixe pour éviter de répéter le nom du jeu à chaque action.
        if (message[0] != '[')
        {
            return message;
        }

        var end = message.IndexOf(']');
        if (end < 2 || end > 40)
        {
            return message;
        }

        if (end + 1 >= message.Length || message[end + 1] != ' ')
        {
            return message;
        }

        var tag = message.Substring(1, end - 1);
        var hasLetter = false;
        foreach (var ch in tag)
        {
            if (char.IsLetter(ch))
            {
                hasLetter = true;
                break;
            }
        }
        if (!hasLetter)
        {
            return message;
        }

        return message.Substring(end + 2).Trim();
    }
}
