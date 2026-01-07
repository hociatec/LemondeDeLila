using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using client_win.Modules.Chat.Models;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.User.Services;

namespace client_win.Modules.Chat.Services;

/// <summary>
/// Orchestration du tchat : vérifie les options, ouvre la connexion WS dédiée et expose l'état/messages.
/// </summary>
public sealed class ChatService : IChatService
{
    private const int MaxMessages = 500;
    private const int DefaultEditWindowSeconds = 5 * 60;
    private readonly ChatClient _client;
    private readonly IOptionsService _options;
    private readonly ISessionService _session;
    private readonly Dispatcher _dispatcher;
    private readonly ISoundService _sounds;
    private readonly IWsTicketProvider _tickets;
    private string? _editingMessageId;

    public ObservableCollection<ChatMessage> Messages { get; } = new();
    public ChatState State { get; private set; } = ChatState.Disconnected;
    public string StatusMessage { get; private set; } = "Tchat fermé.";
    public int EditWindowSeconds { get; private set; } = DefaultEditWindowSeconds;
    public ChatServerError? LastServerError { get; private set; }

    public event Action<string>? StatusChanged;
    public event Action<string>? Error;

    public ChatService(
        Uri endpoint,
        IWebSocketConnection transport,
        IOptionsService options,
        ISessionService session,
        Dispatcher dispatcher,
        ISoundService sounds,
        IWsTicketProvider tickets)
    {
        _client = new ChatClient(endpoint, transport);
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _tickets = tickets ?? throw new ArgumentNullException(nameof(tickets));

        _client.StateChanged += s => _ = _dispatcher.InvokeAsync(() => UpdateState(s), DispatcherPriority.Background);
        _client.ErrorReceived += msg => _ = _dispatcher.InvokeAsync(() => SetStatus(msg, isError: true), DispatcherPriority.Background);
        _client.ErrorDetailsReceived += err =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                LastServerError = err;
                SetStatus(err.Message, isError: true);
            }, DispatcherPriority.Background);
        };
        _client.HistoryReceived += history =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                foreach (var m in history.OrderBy(m => m.Timestamp))
                {
                    AddMessage(m, playReceiveSound: false);
                }
            }, DispatcherPriority.Background);
        };
        _client.EditWindowSecondsReceived += seconds =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                // Clamp defensively (server should do it too).
                EditWindowSeconds = Math.Max(0, Math.Min(86400, seconds));
            }, DispatcherPriority.Background);
        };
        _client.MessageReceived += msg =>
        {
            _ = _dispatcher.InvokeAsync(() => AddMessage(msg, playReceiveSound: true), DispatcherPriority.Background);
        };
        _client.MessageUpdated += msg =>
        {
            _ = _dispatcher.InvokeAsync(() => UpsertMessage(msg, playReceiveSound: false), DispatcherPriority.Background);
        };
        _client.MessageDeleted += id =>
        {
            _ = _dispatcher.InvokeAsync(() => RemoveMessage(id), DispatcherPriority.Background);
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

        LastServerError = null;
        var gate = new TaskCompletionSource<ChatState>(TaskCreationOptions.RunContinuationsAsynchronously);
        var lastState = ChatState.Disconnected;
        string? lastError = null;
        void OnState(ChatState s)
        {
            lastState = s;
            if (s is ChatState.Connected or ChatState.Error or ChatState.Disconnected)
            {
                gate.TrySetResult(s);
            }
        }
        void OnError(string msg)
        {
            lastError = msg;
            gate.TrySetResult(ChatState.Error);
        }

        _client.StateChanged += OnState;
        _client.ErrorReceived += OnError;

        try
        {
            var ticket = await _tickets.GetTicketAsync("presence", cancellationToken).ConfigureAwait(false);
            var headers = string.IsNullOrWhiteSpace(ticket)
                ? null
                : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["x-lila-ws-ticket"] = ticket };
            await _client.ConnectAsync(user.Token, headers, cancellationToken).ConfigureAwait(false);
            // Attendre que la connexion soit réellement stable (évite un "flash" si le serveur refuse aussitôt: ban, etc.)
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(2));
            await gate.Task.WaitAsync(cts.Token).ConfigureAwait(false);

            if (lastState != ChatState.Connected)
            {
                _ = _dispatcher.InvokeAsync(() =>
                        SetStatus(lastError ?? "Accès au tchat refusé.", isError: true),
                    DispatcherPriority.Background);
                return false;
            }

            // Grace window: si le serveur ferme immédiatement après l'ouverture, on considère que l'accès est refusé.
            // Garder ce délai très court pour éviter une latence perceptible à l'ouverture.
            await Task.Delay(75, cancellationToken).ConfigureAwait(false);
            if (lastState != ChatState.Connected)
            {
                _ = _dispatcher.InvokeAsync(() =>
                        SetStatus(lastError ?? "Accès au tchat refusé.", isError: true),
                    DispatcherPriority.Background);
                return false;
            }

            _ = _dispatcher.InvokeAsync(() => SetStatus("Connexion tchat ouverte."), DispatcherPriority.Background);
            return true;
        }
        catch (Exception ex)
        {
            _ = _dispatcher.InvokeAsync(() => SetStatus($"Connexion tchat échouée : {ex.Message}", isError: true), DispatcherPriority.Background);
            return false;
        }
        finally
        {
            _client.StateChanged -= OnState;
            _client.ErrorReceived -= OnError;
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
            if (!string.IsNullOrWhiteSpace(_editingMessageId))
            {
                var targetId = _editingMessageId;
                _editingMessageId = null;
                await _client.EditMessageAsync(targetId, text, cancellationToken).ConfigureAwait(false);
            }
            else
            {
                await _client.SendMessageAsync(text, cancellationToken).ConfigureAwait(false);
                _sounds.Play(SoundId.ChatMessageSent);
            }
        }
        catch (Exception ex)
        {
            SetStatus($"Envoi tchat échoué : {ex.Message}", isError: true);
            throw;
        }
    }

    public Task EditAsync(string messageId, string text, CancellationToken cancellationToken = default)
    {
        _editingMessageId = messageId;
        return SendAsync(text, cancellationToken);
    }

    public async Task DeleteAsync(string messageId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(messageId))
        {
            return;
        }
        try
        {
            if (State != ChatState.Connected)
            {
                bool opened = await OpenAsync(cancellationToken).ConfigureAwait(false);
                if (!opened)
                {
                    throw new InvalidOperationException("Tchat non connecté.");
                }
            }
            await _client.DeleteMessageAsync(messageId, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            SetStatus($"Suppression tchat échouée : {ex.Message}", isError: true);
        }
    }

    public async Task CloseAsync()
    {
        await _client.DisposeAsync().ConfigureAwait(false);
        _ = _dispatcher.InvokeAsync(() => UpdateState(ChatState.Disconnected), DispatcherPriority.Background);
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

    private void AddMessage(ChatMessage message, bool playReceiveSound)
    {
        UpsertMessage(message, playReceiveSound);
    }

    private bool ShouldPlayReceiveSound(ChatMessage message)
    {
        var self = _session.CurrentUser?.Username;
        if (string.IsNullOrWhiteSpace(self))
        {
            return true;
        }

        return !string.Equals(message.User, self, StringComparison.OrdinalIgnoreCase);
    }

    private void UpsertMessage(ChatMessage message, bool playReceiveSound)
    {
        var isMine = message.UserId.HasValue
            ? (_session.CurrentUser?.UserId == message.UserId.Value)
            : string.Equals(message.User, _session.CurrentUser?.Username, StringComparison.OrdinalIgnoreCase);
        var normalized = new ChatMessage(
            message.User,
            message.Text,
            message.Timestamp,
            message.Id,
            message.UserId,
            message.IsDeleted,
            isMine);

        if (string.IsNullOrWhiteSpace(normalized.Id))
        {
            Messages.Add(normalized);
        }
        else
        {
            var idx = FindIndexById(normalized.Id);
            if (normalized.IsDeleted)
            {
                if (idx >= 0)
                {
                    Messages.RemoveAt(idx);
                }
                return;
            }

            if (idx >= 0)
            {
                Messages[idx] = normalized;
            }
            else
            {
                Messages.Add(normalized);
            }
        }

        if (playReceiveSound && !normalized.IsDeleted && ShouldPlayReceiveSound(normalized))
        {
            _sounds.Play(SoundId.ChatMessageReceived);
        }

        while (Messages.Count > MaxMessages)
        {
            Messages.RemoveAt(0);
        }
    }

    private void RemoveMessage(string messageId)
    {
        if (string.IsNullOrWhiteSpace(messageId)) return;
        var idx = FindIndexById(messageId);
        if (idx >= 0)
        {
            Messages.RemoveAt(idx);
        }
    }

    private int FindIndexById(string id)
    {
        for (var i = 0; i < Messages.Count; i++)
        {
            if (string.Equals(Messages[i].Id, id, StringComparison.Ordinal))
            {
                return i;
            }
        }
        return -1;
    }

    public async ValueTask DisposeAsync()
    {
        await _client.DisposeAsync().ConfigureAwait(false);
    }
}
