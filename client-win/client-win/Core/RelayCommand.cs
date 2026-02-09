using System;
using System.Threading;
using System.Windows;
using System.Windows.Input;

namespace client_win.Core;

public sealed class RelayCommand : ICommand
{
    private readonly Action _execute;
    private readonly Func<bool>? _canExecute;
    private readonly SynchronizationContext? _syncContext;

    public RelayCommand(Action execute, Func<bool>? canExecute = null)
    {
        _execute = execute ?? throw new ArgumentNullException(nameof(execute));
        _canExecute = canExecute;
        _syncContext = SynchronizationContext.Current;
    }

    public bool CanExecute(object? parameter) => _canExecute?.Invoke() ?? true;

    public void Execute(object? parameter) => _execute();

    public event EventHandler? CanExecuteChanged;

    public void RaiseCanExecuteChanged()
    {
        var handler = CanExecuteChanged;
        if (handler == null)
        {
            return;
        }

        // If the command was created off the UI thread (no captured sync context),
        // still marshal to the WPF dispatcher to avoid cross-thread crashes.
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher != null && !dispatcher.CheckAccess())
        {
            dispatcher.BeginInvoke(() => handler(this, EventArgs.Empty));
            return;
        }

        // WPF peut appeler CanExecuteChanged depuis des threads de fond (ex: fin de login async).
        // Les handlers WPF (ButtonBase.UpdateCanExecute) exigent le thread UI.
        if (_syncContext == null || ReferenceEquals(SynchronizationContext.Current, _syncContext))
        {
            handler(this, EventArgs.Empty);
            return;
        }

        _syncContext.Post(_ => handler(this, EventArgs.Empty), null);
    }
}
