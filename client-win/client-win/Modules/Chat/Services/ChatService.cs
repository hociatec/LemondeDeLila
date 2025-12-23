using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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
    private readonly ChatClient _client;
    private readonly IOptionsService _options;
    private readonly ISessionService _session;

    public ObservableCollection<ChatMessage> Messages { get; } = new();
    public ChatState State { get; private set; } = ChatState.Disconnected;
    public string StatusMessage { get; private set; } = "Tchat fermé.";

    public event Action<string>? StatusChanged;
    public event Action<string>? Error;

    public ChatService(Uri endpoint, IWebSocketConnection transport, IOptionsService options, ISessionService session)
    {
        _client = new ChatClient(endpoint, transport);
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _session = session ?? throw new ArgumentNullException(nameof(session));

        _client.StateChanged += s => UpdateState(s);
        _client.ErrorReceived += msg => SetStatus(msg, isError: true);
        _client.HistoryReceived += history =>
        {
            foreach (var m in history.OrderBy(m => m.Timestamp))
            {
                Messages.Add(m);
            }
        };
        _client.MessageReceived += msg =>
        {
            Messages.Add(msg);
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
            SetStatus("Connexion tchat ouverte.");
            return true;
        }
        catch (Exception ex)
        {
            SetStatus($"Connexion tchat échouée : {ex.Message}", isError: true);
            return false;
        }
    }

    public async Task SendAsync(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }
        await _client.SendMessageAsync(text, cancellationToken).ConfigureAwait(false);
    }

    public async Task CloseAsync()
    {
        await _client.DisposeAsync().ConfigureAwait(false);
        UpdateState(ChatState.Disconnected);
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

    public async ValueTask DisposeAsync()
    {
        await _client.DisposeAsync().ConfigureAwait(false);
    }
}
