using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;
using System.Linq;
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

    public ChatViewModel(IChatService chat, Action? closeWindow = null)
    {
        _chat = chat ?? throw new ArgumentNullException(nameof(chat));
        _closeWindow = closeWindow;
        Messages = chat.Messages;
        Items = new ObservableCollection<ChatMessageItem>();
        _status = chat.StatusMessage;
        chat.StatusChanged += msg => Status = msg;
        chat.Error += msg => Status = msg;

        SendCommand = new AsyncRelayCommand(SendAsync, () => CanSend);
        CloseCommand = new RelayCommand(() => _closeWindow?.Invoke());

        if (Messages is INotifyCollectionChanged coll)
        {
            coll.CollectionChanged += (_, _) => RebuildItems();
        }
        RebuildItems();
    }

    public ObservableCollection<ChatMessage> Messages { get; }

    public ObservableCollection<ChatMessageItem> Items { get; }

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

    private void RebuildItems()
    {
        var ordered = Messages
            .Select(m =>
            {
                var local = m.Timestamp.Kind == DateTimeKind.Unspecified ? m.Timestamp : m.Timestamp.ToLocalTime();
                return (m, local);
            })
            .OrderBy(x => x.local)
            .ToArray();

        Items.Clear();
        foreach (var entry in ordered)
        {
            Items.Add(new ChatMessageItem(entry.m, entry.local));
        }
    }

    public sealed class ChatMessageItem
    {
        public ChatMessageItem(ChatMessage message, DateTime localTimestamp)
        {
            Message = message;
            LocalTimestamp = localTimestamp;
        }

        public ChatMessage Message { get; }
        public DateTime LocalTimestamp { get; }

        public string DisplayText
        {
            get
            {
                var user = (Message.User ?? string.Empty).Trim();
                var text = (Message.Text ?? string.Empty).TrimEnd();
                var time = LocalTimestamp.ToString("HH:mm", CultureInfo.GetCultureInfo("fr-FR"));
                if (string.IsNullOrWhiteSpace(user))
                {
                    return $"{time} {text}";
                }
                if (string.IsNullOrWhiteSpace(text))
                {
                    return $"{time} {user}";
                }
                return $"{time} {user} : {text}";
            }
        }
    }
}
