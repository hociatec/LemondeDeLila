using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;

namespace client_win.Core;

public sealed class AsyncRelayCommand : ICommand
{
    private readonly Func<Task> _execute;
    private readonly Func<bool>? _canExecute;
    private readonly Action<Exception>? _onException;
    private bool _isExecuting;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly SynchronizationContext? _syncContext;

    public AsyncRelayCommand(Func<Task> execute, Func<bool>? canExecute = null, Action<Exception>? onException = null)
    {
        _execute = execute ?? throw new ArgumentNullException(nameof(execute));
        _canExecute = canExecute;
        _onException = onException;
        _syncContext = SynchronizationContext.Current;
    }

    public bool CanExecute(object? parameter) => !_isExecuting && (_canExecute?.Invoke() ?? true);

    public async void Execute(object? parameter) => await ExecuteAsync(parameter).ConfigureAwait(true);

    public async Task ExecuteAsync(object? parameter)
    {
        if (!CanExecute(parameter))
        {
            return;
        }

        await _gate.WaitAsync().ConfigureAwait(true);
        try
        {
            if (_isExecuting)
            {
                return;
            }

            _isExecuting = true;
            RaiseCanExecuteChanged();

            try
            {
                await _execute().ConfigureAwait(true);
            }
            catch (Exception ex)
            {
                if (_onException != null)
                {
                    _onException(ex);
                    return;
                }
                throw;
            }
        }
        finally
        {
            _isExecuting = false;
            RaiseCanExecuteChanged();
            _gate.Release();
        }
    }

    public event EventHandler? CanExecuteChanged;

    public void RaiseCanExecuteChanged()
    {
        var handler = CanExecuteChanged;
        if (handler == null)
        {
            return;
        }

        // Peut être déclenché depuis des threads de fond (continuations async).
        // Les handlers WPF exigent le thread UI.
        if (_syncContext == null || ReferenceEquals(SynchronizationContext.Current, _syncContext))
        {
            handler(this, EventArgs.Empty);
            return;
        }

        _syncContext.Post(_ => handler(this, EventArgs.Empty), null);
    }
}
