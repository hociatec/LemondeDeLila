using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;

namespace client_win.Core;

public sealed class AsyncRelayCommand<T> : ICommand
{
    private readonly Func<T?, Task> _execute;
    private readonly Predicate<T?>? _canExecute;
    private readonly Action<Exception>? _onException;
    private bool _isExecuting;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public AsyncRelayCommand(Func<T?, Task> execute, Predicate<T?>? canExecute = null, Action<Exception>? onException = null)
    {
        _execute = execute ?? throw new ArgumentNullException(nameof(execute));
        _canExecute = canExecute;
        _onException = onException;
    }

    public bool CanExecute(object? parameter)
    {
        if (_isExecuting)
        {
            return false;
        }

        if (_canExecute == null)
        {
            return true;
        }

        return _canExecute(parameter is T t ? t : default);
    }

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
                await _execute(parameter is T t ? t : default).ConfigureAwait(true);
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

    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}

