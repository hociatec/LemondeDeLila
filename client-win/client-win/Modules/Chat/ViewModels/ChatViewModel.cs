using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;
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
    private string _historyText = string.Empty;
    private string _status = "Tchat fermé.";

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
        await _chat.SendAsync(toSend);
    }

    private void RebuildHistory()
    {
        var builder = new StringBuilder();
        foreach (var m in Messages)
        {
            var user = (m.User ?? string.Empty).Trim();
            var text = (m.Text ?? string.Empty).TrimEnd();
            if (string.IsNullOrWhiteSpace(user) && string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            var local = m.Timestamp.Kind == DateTimeKind.Unspecified ? m.Timestamp : m.Timestamp.ToLocalTime();
            var time = local.ToString("HH:mm", CultureInfo.GetCultureInfo("fr-FR"));

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
        }

        HistoryText = builder.ToString().TrimEnd('\r', '\n');
    }
}
