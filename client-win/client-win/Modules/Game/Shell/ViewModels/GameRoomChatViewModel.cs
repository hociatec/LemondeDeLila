using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;

namespace client_win.Modules.Game.Shell.ViewModels;

public sealed class GameRoomChatViewModel : ObservableObject
{
    private string _message = string.Empty;
    private bool _isEnabled;
    private bool _isSoundsEnabled;
    private string _selfUsername = string.Empty;
    private readonly Dictionary<string, int> _pendingEcho = new(StringComparer.OrdinalIgnoreCase);

    public GameRoomChatViewModel(bool enabled, Func<string, Task> send)
    {
        _isEnabled = enabled;
        _isSoundsEnabled = true;
        SendCommand = new AsyncRelayCommand(
            execute: SendAsync,
            canExecute: () => IsEnabled && !string.IsNullOrWhiteSpace(Message),
            onException: _ => { });

        _send = send ?? throw new ArgumentNullException(nameof(send));
    }

    private readonly Func<string, Task> _send;

    public Action<string>? LocalEcho { get; set; }

    public string SelfUsername
    {
        get => _selfUsername;
        set => SetProperty(ref _selfUsername, value ?? string.Empty);
    }

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

    public bool IsSoundsEnabled
    {
        get => _isSoundsEnabled;
        set => SetProperty(ref _isSoundsEnabled, value);
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

        RegisterPendingEcho(text);
        LocalEcho?.Invoke(text);
        Message = string.Empty;
        await _send(text).ConfigureAwait(true);
    }

    public bool ConsumePendingEcho(string message)
    {
        var key = (message ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(key))
        {
            return false;
        }

        lock (_pendingEcho)
        {
            if (!_pendingEcho.TryGetValue(key, out var count) || count <= 0)
            {
                return false;
            }

            count--;
            if (count <= 0)
            {
                _pendingEcho.Remove(key);
            }
            else
            {
                _pendingEcho[key] = count;
            }

            return true;
        }
    }

    private void RegisterPendingEcho(string message)
    {
        var key = (message ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(key))
        {
            return;
        }

        lock (_pendingEcho)
        {
            _pendingEcho.TryGetValue(key, out var count);
            _pendingEcho[key] = Math.Min(count + 1, 5);
        }
    }
}
