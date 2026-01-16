using System;
using System.Threading;
using System.Windows.Threading;

namespace client_win.Modules.Audio.Services;

public sealed class AudioDispatcher : IAudioDispatcher, IDisposable
{
    private readonly Thread _thread;
    private readonly ManualResetEventSlim _ready = new(false);
    private Dispatcher? _dispatcher;

    public AudioDispatcher()
    {
        _thread = new Thread(Run)
        {
            IsBackground = true,
            Name = "AudioDispatcher"
        };
        _thread.SetApartmentState(ApartmentState.STA);
        _thread.Start();
        _ready.Wait(TimeSpan.FromSeconds(10));
        if (_dispatcher == null)
        {
            throw new InvalidOperationException("Audio dispatcher thread failed to start.");
        }
    }

    public Dispatcher Dispatcher => _dispatcher ?? throw new InvalidOperationException("Audio dispatcher not available.");

    private void Run()
    {
        try
        {
            _dispatcher = Dispatcher.CurrentDispatcher;
            _ready.Set();
            Dispatcher.Run();
        }
        catch
        {
            _ready.Set();
        }
    }

    public void Dispose()
    {
        var dispatcher = _dispatcher;
        if (dispatcher == null)
        {
            return;
        }

        try
        {
            dispatcher.BeginInvokeShutdown(DispatcherPriority.Background);
        }
        catch
        {
            // ignore
        }
    }
}

