using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using client_win.Modules.Chat.Models;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Settings.Services;
using client_win.Modules.User.Services;

namespace client_win.Modules.Chat.Services;

/// <summary>
/// Orchestration du tchat : vérifie les options, ouvre la connexion WS dédiée et expose l'état/messages.
/// </summary>
public sealed class ChatService : IChatService
{
    private const int MaxMessages = 500;
    private readonly ChatClient _client;
    private readonly IOptionsService _options;
    private readonly ISessionService _session;
    private readonly Dispatcher _dispatcher;
    private readonly HashSet<string> _seenMessageKeys = new(StringComparer.Ordinal);

    public ObservableCollection<ChatMessage> Messages { get; } = new();
    public ChatState State { get; private set; } = ChatState.Disconnected;
    public string StatusMessage { get; private set; } = "Tchat fermé.";

    public event Action<string>? StatusChanged;
    public event Action<string>? Error;

    public ChatService(Uri endpoint, IWebSocketConnection transport, IOptionsService options, ISessionService session, Dispatcher dispatcher)
    {
        _client = new ChatClient(endpoint, transport);
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));

        _client.StateChanged += s => _dispatcher.InvokeAsync(() => UpdateState(s), DispatcherPriority.Background);
        _client.ErrorReceived += msg => _dispatcher.InvokeAsync(() => SetStatus(msg, isError: true), DispatcherPriority.Background);
        _client.HistoryReceived += history =>
        {
            _dispatcher.InvokeAsync(() =>
            {
                foreach (var m in history.OrderBy(m => m.Timestamp))
                {
                    AddMessage(m);
                }
            }, DispatcherPriority.Background);
        };
        _client.MessageReceived += msg =>
        {
            _dispatcher.InvokeAsync(() => AddMessage(msg), DispatcherPriority.Background);
        };
    }

    public async Task<bool> OpenAsync(CancellationToken cancellationToken = default)
    {
        if (!_options.Current.ChatEnabled)
        {
            SetStatus("Tchat désactivé dans les options.", isError: true);
            return false;
        }
        var user = _session.CurrentUser;
        if (user == null || string.IsNullOrWhiteSpace(user.Token))
        {
            SetStatus("Authentification requise pour ouvrir le tchat.", isError: true);
            return false;
        }

        try
        {
            await _client.ConnectAsync(user.Token, cancellationToken).ConfigureAwait(false);
            _dispatcher.InvokeAsync(() => SetStatus("Connexion tchat ouverte."), DispatcherPriority.Background);
            return true;
        }
        catch (Exception ex)
        {
            _dispatcher.InvokeAsync(() => SetStatus($"Connexion tchat échouée : {ex.Message}", isError: true), DispatcherPriority.Background);
            return false;
        }
    }

    public async Task SendAsync(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }
        try
        {
            if (State != ChatState.Connected)
            {
                // UX: si le tchat s'est déconnecté (réseau, veille, etc.), tenter une reconnexion
                // plutôt que d'afficher une exception "WebSocket non connecté.".
                bool opened = await OpenAsync(cancellationToken).ConfigureAwait(false);
                if (!opened)
                {
                    throw new InvalidOperationException("Tchat non connecté.");
                }
            }
            await _client.SendMessageAsync(text, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            SetStatus($"Envoi tchat échoué : {ex.Message}", isError: true);
            throw;
        }
    }

    public async Task CloseAsync()
    {
        await _client.DisposeAsync().ConfigureAwait(false);
        _dispatcher.InvokeAsync(() => UpdateState(ChatState.Disconnected), DispatcherPriority.Background);
    }

    private void UpdateState(ChatState state)
    {
        State = state;
        string status = state switch
        {
            ChatState.Connecting => "Connexion au serveur de tchat...",
            ChatState.Connected => "Tchat connecté.",
            ChatState.Error => "Erreur tchat.",
            _ => "Tchat fermé."
        };
        SetStatus(status, state == ChatState.Error);
    }

    private void SetStatus(string message, bool isError = false)
    {
        StatusMessage = message;
        if (isError)
        {
            Error?.Invoke(message);
        }
        else
        {
            StatusChanged?.Invoke(message);
        }
    }

    private void AddMessage(ChatMessage message)
    {
        var key = GetMessageKey(message);
        if (!_seenMessageKeys.Add(key))
        {
            return;
        }

        Messages.Add(message);
        while (Messages.Count > MaxMessages)
        {
            var removed = Messages[0];
            Messages.RemoveAt(0);
            _seenMessageKeys.Remove(GetMessageKey(removed));
        }
    }

    private static string GetMessageKey(ChatMessage message)
    {
        if (!string.IsNullOrWhiteSpace(message.Id))
        {
            return $"id:{message.Id}";
        }
        return $"legacy:{message.User}\n{message.Timestamp:O}\n{message.Text}";
    }

    public async ValueTask DisposeAsync()
    {
        await _client.DisposeAsync().ConfigureAwait(false);
    }
}
