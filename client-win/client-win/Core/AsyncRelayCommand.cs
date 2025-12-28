using System;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows.Threading;
using Serilog;

namespace client_win.Core;

public sealed class AsyncRelayCommand : ICommand
{
    private readonly Func<Task> _executeAsync;
    private readonly Func<bool>? _canExecute;
    private readonly Action<Exception>? _onException;
    private bool _isExecuting;

    public AsyncRelayCommand(Func<Task> executeAsync, Func<bool>? canExecute = null, Action<Exception>? onException = null)
    {
        _executeAsync = executeAsync ?? throw new ArgumentNullException(nameof(executeAsync));
        _canExecute = canExecute;
        _onException = onException;
    }

    public bool CanExecute(object? parameter) => !_isExecuting && (_canExecute?.Invoke() ?? true);

    public async void Execute(object? parameter)
    {
        await ExecuteAsync(parameter).ConfigureAwait(true);
    }

    public async Task ExecuteAsync(object? parameter = null)
    {
        if (!CanExecute(parameter))
        {
            return;
        }

        try
        {
            _isExecuting = true;
            RaiseCanExecuteChanged();
            await _executeAsync().ConfigureAwait(true); // ConfigureAwait(true) pour rester sur le UI thread WPF
        }
        catch (Exception ex)
        {
            if (_onException != null)
            {
                _onException(ex);
            }
            else
            {
                Log.Error(ex, "Erreur AsyncRelayCommand (non gérée)");
            }
        }
        finally
        {
            _isExecuting = false;
            RaiseCanExecuteChanged();
        }
    }

    public event EventHandler? CanExecuteChanged;

    public void RaiseCanExecuteChanged()
    {
        if (Dispatcher.CurrentDispatcher.CheckAccess())
        {
            CanExecuteChanged?.Invoke(this, EventArgs.Empty);
        }
        else
        {
            Dispatcher.CurrentDispatcher.Invoke(() => CanExecuteChanged?.Invoke(this, EventArgs.Empty));
        }
    }
}
