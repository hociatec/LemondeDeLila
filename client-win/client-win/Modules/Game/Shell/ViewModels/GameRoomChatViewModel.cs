using System;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;

namespace client_win.Modules.Game.Shell.ViewModels;

public sealed class GameRoomChatViewModel : ObservableObject
{
    private string _message = string.Empty;
    private bool _isEnabled;

    public GameRoomChatViewModel(bool enabled, Func<string, Task> send)
    {
        _isEnabled = enabled;
        SendCommand = new AsyncRelayCommand(
            execute: SendAsync,
            canExecute: () => IsEnabled && !string.IsNullOrWhiteSpace(Message),
            onException: _ => { });

        _send = send ?? throw new ArgumentNullException(nameof(send));
    }

    private readonly Func<string, Task> _send;

    public bool IsEnabled
    {
        get => _isEnabled;
        set
        {
            if (!SetProperty(ref _isEnabled, value))
            {
                return;
            }

            if (SendCommand is AsyncRelayCommand cmd)
            {
                cmd.RaiseCanExecuteChanged();
            }
        }
    }

    public string Message
    {
        get => _message;
        set
        {
            if (!SetProperty(ref _message, value))
            {
                return;
            }

            if (SendCommand is AsyncRelayCommand cmd)
            {
                cmd.RaiseCanExecuteChanged();
            }
        }
    }

    public ICommand SendCommand { get; }

    private async Task SendAsync()
    {
        if (!IsEnabled)
        {
            return;
        }

        var text = (Message ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        Message = string.Empty;
        await _send(text).ConfigureAwait(true);
    }
}
