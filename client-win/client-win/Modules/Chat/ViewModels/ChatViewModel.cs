using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Chat.Models;
using client_win.Modules.Chat.Services;

namespace client_win.Modules.Chat.ViewModels;

public sealed class ChatViewModel : ObservableObject
{
    private readonly IChatService _chat;
    private readonly Action? _closeWindow;
    private string _input = string.Empty;
    private string _status = "Tchat fermé.";
    private string _historyText = string.Empty;
    private readonly StringBuilder _historyBuilder = new();

    public ChatViewModel(IChatService chat, Action? closeWindow = null)
    {
        _chat = chat ?? throw new ArgumentNullException(nameof(chat));
        _closeWindow = closeWindow;
        Messages = chat.Messages;
        _status = chat.StatusMessage;
        chat.StatusChanged += msg => Status = msg;
        chat.Error += msg => Status = msg;

        SendCommand = new AsyncRelayCommand(SendAsync, () => CanSend);
        CloseCommand = new RelayCommand(() => _closeWindow?.Invoke());

        if (Messages is INotifyCollectionChanged coll)
        {
            coll.CollectionChanged += (_, args) => OnMessagesChanged(args);
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
        await _chat.SendAsync(toSend);
    }

    private void OnMessagesChanged(NotifyCollectionChangedEventArgs args)
    {
        if (args.Action == NotifyCollectionChangedAction.Add && args.NewItems != null)
        {
            foreach (var item in args.NewItems)
            {
                if (item is ChatMessage m)
                {
                    AppendLine(m);
                }
            }
            return;
        }

        RebuildHistory();
    }

    private void RebuildHistory()
    {
        _historyBuilder.Clear();
        foreach (var m in Messages)
        {
            if (string.IsNullOrWhiteSpace(m.Text) && string.IsNullOrWhiteSpace(m.User))
            {
                continue;
            }
            if (_historyBuilder.Length > 0)
            {
                _historyBuilder.AppendLine();
            }
            _historyBuilder.Append(FormatLine(m));
        }
        HistoryText = EnsureTrailingEmptyLine(_historyBuilder.ToString());
    }

    private void AppendLine(ChatMessage m)
    {
        if (string.IsNullOrWhiteSpace(m.Text) && string.IsNullOrWhiteSpace(m.User))
        {
            return;
        }
        if (_historyBuilder.Length > 0)
        {
            _historyBuilder.AppendLine();
        }
        _historyBuilder.Append(FormatLine(m));
        HistoryText = EnsureTrailingEmptyLine(_historyBuilder.ToString());
    }

    private static string FormatLine(ChatMessage m)
    {
        var user = (m.User ?? string.Empty).Trim();
        var text = (m.Text ?? string.Empty).TrimEnd();

        if (string.IsNullOrWhiteSpace(user))
        {
            return text;
        }
        if (string.IsNullOrWhiteSpace(text))
        {
            return user;
        }
        return $"{user} : {text}";
    }

    private static string EnsureTrailingEmptyLine(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        // Une "ligne vide à la fin" = le texte se termine par un saut de ligne.
        return text.EndsWith(Environment.NewLine, StringComparison.Ordinal)
            ? text
            : text + Environment.NewLine;
    }
}
