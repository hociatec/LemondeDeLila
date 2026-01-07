using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Chat.Models;
using client_win.Modules.Chat.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Chat.ViewModels;

public sealed class ChatViewModel : ObservableObject
{
    private sealed record HistorySpan(int Start, int End, ChatMessage Message);

    private readonly IChatService _chat;
    private readonly Action? _closeWindow;
    private readonly IDialogService? _dialogs;
    private string _input = string.Empty;
    private string _historyText = string.Empty;
    private string _status = "Tchat fermé.";
    private string? _pendingEditMessageId;
    private HistorySpan[] _historySpans = Array.Empty<HistorySpan>();

    public ChatViewModel(IChatService chat, Action? closeWindow = null, IDialogService? dialogs = null)
    {
        _chat = chat ?? throw new ArgumentNullException(nameof(chat));
        _closeWindow = closeWindow;
        _dialogs = dialogs;
        Messages = chat.Messages;
        _status = chat.StatusMessage;
        chat.StatusChanged += msg => Status = msg;
        chat.Error += msg => Status = msg;

        SendCommand = new AsyncRelayCommand(SendAsync, () => CanSend);
        CloseCommand = new RelayCommand(() => _closeWindow?.Invoke());

        if (Messages is INotifyCollectionChanged coll)
        {
            coll.CollectionChanged += (_, _) => RebuildHistory();
        }
        RebuildHistory();
    }

    public ObservableCollection<ChatMessage> Messages { get; }

    public string Input
    {
        get => _input;
        set
        {
            if (SetProperty(ref _input, value))
            {
                (SendCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
            }
        }
    }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public bool CanSend => !string.IsNullOrWhiteSpace(Input);

    public string HistoryText
    {
        get => _historyText;
        private set => SetProperty(ref _historyText, value);
    }

    public ICommand SendCommand { get; }
    public ICommand CloseCommand { get; }

    private async Task SendAsync()
    {
        if (!CanSend)
        {
            return;
        }
        string toSend = Input;
        Input = string.Empty;
        if (!string.IsNullOrWhiteSpace(_pendingEditMessageId))
        {
            var targetId = _pendingEditMessageId;
            _pendingEditMessageId = null;
            await _chat.EditAsync(targetId!, toSend);
            return;
        }

        await _chat.SendAsync(toSend);
    }

    public Task<bool> HandleHistoryActionAsync(int caretIndex)
    {
        var msg = FindMessageAtCaret(caretIndex);
        if (!CanActOnMessage(msg))
        {
            return Task.FromResult(false);
        }

        return HandleMessageActionAsync(msg!);
    }

    private async Task<bool> HandleMessageActionAsync(ChatMessage msg)
    {
        if (_dialogs == null)
        {
            BeginEdit(msg);
            return true;
        }

        var choice = await _dialogs.Choose(
            "Tchat",
            "Que voulez-vous faire avec ce message ?\n\nNote : l’édition/suppression n’est possible que pendant un délai limité après l’envoi.",
            primaryText: "Modifier",
            secondaryText: "Supprimer",
            cancelText: "Annuler");

        if (choice == DialogChoice.Primary)
        {
            BeginEdit(msg);
            return true;
        }

        if (choice == DialogChoice.Secondary)
        {
            var confirm = await _dialogs.Confirm(
                "Tchat",
                "Supprimer ce message ?\n\nCette action est irréversible.",
                okText: "Supprimer",
                cancelText: "Annuler");
            if (confirm == true)
            {
                await DeleteAsync(msg);
            }
            return false;
        }

        return false;
    }

    private bool CanActOnMessage(ChatMessage? message)
    {
        if (message == null || !message.IsMine || string.IsNullOrWhiteSpace(message.Id))
        {
            return false;
        }

        var windowSeconds = Math.Max(0, _chat.EditWindowSeconds);
        if (windowSeconds <= 0)
        {
            return false;
        }

        var ts = message.Timestamp.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(message.Timestamp, DateTimeKind.Utc)
            : message.Timestamp.ToUniversalTime();
        var age = DateTime.UtcNow - ts;
        if (age < TimeSpan.Zero)
        {
            age = TimeSpan.Zero;
        }

        return age <= TimeSpan.FromSeconds(windowSeconds);
    }

    private ChatMessage? FindMessageAtCaret(int caretIndex)
    {
        if (_historySpans.Length == 0)
        {
            return null;
        }

        var idx = Math.Max(0, caretIndex);
        foreach (var span in _historySpans)
        {
            if (idx >= span.Start && idx <= span.End)
            {
                return span.Message;
            }
        }

        // Si le caret est en fin de texte, prendre le dernier message.
        var last = _historySpans[^1];
        return idx >= last.End ? last.Message : null;
    }

    private void BeginEdit(ChatMessage message)
    {
        if (string.IsNullOrWhiteSpace(message.Id))
        {
            return;
        }

        _pendingEditMessageId = message.Id;
        Input = message.Text;
        Status = $"Édition du message… ({_chat.EditWindowSeconds}s)";
    }

    private Task DeleteAsync(ChatMessage message)
    {
        if (string.IsNullOrWhiteSpace(message.Id))
        {
            return Task.CompletedTask;
        }

        if (string.Equals(_pendingEditMessageId, message.Id, StringComparison.Ordinal))
        {
            _pendingEditMessageId = null;
        }

        return _chat.DeleteAsync(message.Id);
    }

    private void RebuildHistory()
    {
        var builder = new StringBuilder();
        var spans = new System.Collections.Generic.List<HistorySpan>(capacity: Math.Max(0, Messages.Count));

        foreach (var m in Messages)
        {
            var user = (m.User ?? string.Empty).Trim();
            var text = (m.Text ?? string.Empty).TrimEnd();
            // Garder l'historique sur une ligne par message (simplifie l'action sur la ligne).
            text = text.Replace("\r", " ").Replace("\n", " ");
            if (string.IsNullOrWhiteSpace(user) && string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            var local = m.Timestamp.Kind == DateTimeKind.Unspecified ? m.Timestamp : m.Timestamp.ToLocalTime();
            var time = local.ToString("HH:mm", CultureInfo.GetCultureInfo("fr-FR"));

            var start = builder.Length;
            if (string.IsNullOrWhiteSpace(user))
            {
                builder.AppendLine($"{time} {text}");
            }
            else if (string.IsNullOrWhiteSpace(text))
            {
                builder.AppendLine($"{time} {user}");
            }
            else
            {
                builder.AppendLine($"{time} {user} : {text}");
            }
            var end = builder.Length;
            spans.Add(new HistorySpan(start, end, m));
        }

        // Ajouter une ligne vide à la fin : améliore le confort de lecture (dernier message non "collé" au bord).
        var history = builder.ToString().TrimEnd('\r', '\n');
        HistoryText = string.IsNullOrEmpty(history) ? string.Empty : history + Environment.NewLine;
        _historySpans = spans.ToArray();
    }
}
