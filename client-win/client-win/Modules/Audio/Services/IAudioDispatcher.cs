using System.Windows.Threading;

namespace client_win.Modules.Audio.Services;

public interface IAudioDispatcher
{
    Dispatcher Dispatcher { get; }
}

