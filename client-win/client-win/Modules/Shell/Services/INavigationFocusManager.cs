using System;

namespace client_win.Modules.Shell.Services;

public interface INavigationFocusManager
{
    /// <summary>
    /// Called on the UI thread immediately before swapping the shell content.
    /// Must be fast and best-effort.
    /// </summary>
    void BeforeNavigation();

    /// <summary>
    /// Called on the UI thread immediately after swapping the shell content.
    /// </summary>
    void AfterNavigation(object newContent);
}

