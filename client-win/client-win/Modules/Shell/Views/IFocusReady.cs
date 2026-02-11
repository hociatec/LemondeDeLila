using System;

namespace client_win.Modules.Shell.Views;

/// <summary>
/// Optional contract for views that can indicate when their visual tree is ready to receive initial keyboard focus.
/// This avoids brute-force timeouts and repeated focus attempts while item containers are still being generated.
/// </summary>
public interface IFocusReady
{
    bool IsFocusReady { get; }

    event EventHandler? FocusReadyChanged;
}

