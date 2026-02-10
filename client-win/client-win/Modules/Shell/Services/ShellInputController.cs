using System;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Catalog.ViewModels;
using client_win.Modules.Catalog.Views;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Presence.Views;
using client_win.Modules.Presence.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Shell.Services;

public sealed class ShellInputController
{
    private readonly IPresenceMonitor _presence;
    private readonly IPresenceLauncher _presenceUi;
    private readonly INavigationService _navigation;
    private readonly IMenuRouter _menuRouter;
    private readonly IHomeViewAccessor _home;
    private int _didInitialActivationFocus;

    public ShellInputController(
        IPresenceMonitor presence,
        IPresenceLauncher presenceUi,
        INavigationService navigation,
        IMenuRouter menuRouter,
        IHomeViewAccessor home)
    {
        _presence = presence ?? throw new ArgumentNullException(nameof(presence));
        _presenceUi = presenceUi ?? throw new ArgumentNullException(nameof(presenceUi));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _menuRouter = menuRouter ?? throw new ArgumentNullException(nameof(menuRouter));
        _home = home ?? throw new ArgumentNullException(nameof(home));
    }

    public void OnPreviewKeyDown(Window window, KeyEventArgs e)
    {
        if (e == null) throw new ArgumentNullException(nameof(e));

        try
        {
            var interactionKey = e.Key == Key.System ? e.SystemKey : e.Key;
            if (interactionKey is not (Key.LeftShift or Key.RightShift or Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin))
            {
                _ = _presence.NotifyUserInteractionAsync();
            }
        }
        catch
        {
            // ignore
        }

        var isAlt = (Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt;
        var isCtrl = (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control;
        var isShift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
        var key = e.Key == Key.System ? e.SystemKey : e.Key;

        // Global focus safety (NVDA/keyboard-only): never allow Tab to "escape" the current view.
        // This can happen when focus is temporarily parked on RootHost during navigation, or if a view's
        // tab navigation chain ends up at the Window level.
        if (key == Key.Tab && window != null)
        {
            try
            {
                var focused = Keyboard.FocusedElement;
                if (focused is Window ||
                    (focused is FrameworkElement fe &&
                     (string.Equals(fe.Name, "RootHost", StringComparison.Ordinal) ||
                      string.Equals(fe.Name, "FocusSentinel", StringComparison.Ordinal))))
                {
                    var root = TryGetContentRoot(window);
                    if (root is UIElement rootUi)
                    {
                        e.Handled = true;
                        _ = window.Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                        {
                            try
                            {
                                // Prefer each screen's explicit initial focus target when tabbing forward.
                                if (!isShift && rootUi is IInitialFocusTarget focusTarget)
                                {
                                    try { focusTarget.RequestInitialFocus(); } catch { /* ignore */ }
                                }

                                if (Keyboard.FocusedElement is DependencyObject dep && IsDescendantOrSelf(dep, rootUi))
                                {
                                    return;
                                }

                                try { rootUi.Focus(); } catch { /* ignore */ }
                                try { Keyboard.Focus(rootUi); } catch { /* ignore */ }
                                try
                                {
                                    rootUi.MoveFocus(new TraversalRequest(isShift
                                        ? FocusNavigationDirection.Last
                                        : FocusNavigationDirection.First));
                                }
                                catch
                                {
                                    // ignore
                                }
                            }
                            catch
                            {
                                // ignore
                            }
                        }));
                        return;
                    }
                }
            }
            catch
            {
                // ignore
            }
        }

        if (isAlt && key == Key.F4)
        {
            e.Handled = true;
            window?.Close();
            return;
        }

        if (key == Key.F3)
        {
            e.Handled = true;
            _ = Application.Current?.Dispatcher?.BeginInvoke(DispatcherPriority.Input, new Action(async () =>
            {
                try
                {
                    await _menuRouter.OpenContactAdmin().ConfigureAwait(true);
                }
                catch
                {
                    // ignore
                }
            }));
            return;
        }

        // Presence shortcut screen: handle Escape at the window level so it works even if focus is temporarily
        // parked on a stable shell element during navigation (NVDA focus safety).
        if (key == Key.Escape)
        {
            try
            {
                // Tavern (Catalog): handle Escape at the window level for the same reason as Presence.
                // When focus is parked on RootHost during a navigation/focus-safety pass, the CatalogView's
                // PreviewKeyDown won't receive the event (tunneling targets the focused element only).
                if (_navigation.CurrentContent is CatalogViewModel cvm)
                {
                    e.Handled = true;
                    _ = Application.Current?.Dispatcher?.BeginInvoke(
                        DispatcherPriority.Background,
                        new Action(() =>
                        {
                            try
                            {
                                var root = window != null ? TryGetContentRoot(window) : null;
                                if (root is CatalogView cv)
                                {
                                    var inCategoriesColumn = cv.IsCategoriesColumnFocused || !cv.IsKeyboardFocusWithin;
                                    var inSubCategoriesColumn = cv.IsSubCategoriesColumnFocused;
                                    var result = cvm.HandleEscape(inCategoriesColumn, inSubCategoriesColumn);

                                    if (cv.IsLoaded && cv.IsVisible && ReferenceEquals(cv.DataContext, cvm))
                                    {
                                        _ = cv.Dispatcher.BeginInvoke(
                                            DispatcherPriority.Input,
                                            new Action(() => cv.FocusAfterEscapeFromShell(result)));
                                    }

                                    EnsureCatalogCloseNavigatesSomewhere(cvm, result);
                                }
                                else
                                {
                                    // Best-effort fallback: if we can't resolve the view, still honor Escape.
                                    var result = cvm.HandleEscape(closeFromCategoryColumn: true, fromSubCategoryColumn: false);
                                    EnsureCatalogCloseNavigatesSomewhere(cvm, result);
                                }
                            }
                            catch
                            {
                                // ignore
                            }
                        }));
                    return;
                }

                if (_navigation.CurrentContent is PresenceViewModel pvm)
                {
                    e.Handled = true;
                    _ = Application.Current?.Dispatcher?.BeginInvoke(
                        DispatcherPriority.Background,
                        new Action(() =>
                        {
                            try { pvm.HandleEscape(); } catch { /* ignore */ }
                        }));
                    return;
                }

                if (_navigation.CurrentContent is PresenceView pv && pv.DataContext is PresenceViewModel pvm2)
                {
                    e.Handled = true;
                    _ = Application.Current?.Dispatcher?.BeginInvoke(
                        DispatcherPriority.Background,
                        new Action(() =>
                        {
                            try { pvm2.HandleEscape(); } catch { /* ignore */ }
                        }));
                    return;
                }
            }
            catch
            {
                // ignore
            }
        }

        if (isCtrl && key == Key.U)
        {
            e.Handled = true;
            if (_navigation.CurrentContent is PresenceViewModel or PresenceView)
            {
                return;
            }

            var owner = window ?? Application.Current?.MainWindow;
            if (owner == null)
            {
                return;
            }

            _ = owner.Dispatcher.BeginInvoke(
                DispatcherPriority.Background,
                new Action(async () =>
                {
                    try
                    {
                        await _presenceUi.OpenAsync(owner).ConfigureAwait(true);
                    }
                    catch
                    {
                        // ignore
                    }
                }));
        }
    }

    public void OnPreviewMouseDown(MouseButtonEventArgs e)
    {
        try
        {
            _ = _presence.NotifyUserInteractionAsync();
        }
        catch
        {
            // ignore
        }
    }

    public void OnActivated()
    {
        try
        {
            if (_navigation.CurrentContent is GameRoomView room)
            {
                Application.Current?.Dispatcher?.BeginInvoke(DispatcherPriority.Input, new Action(room.RequestFocusGameZone));
                return;
            }

            var window = Application.Current?.MainWindow;
            if (window == null)
            {
                return;
            }

            var root = TryGetContentRoot(window);
            if (root is IInitialFocusTarget focusTarget)
            {
                if (Interlocked.Exchange(ref _didInitialActivationFocus, 1) == 1)
                {
                    return;
                }

                void Request()
                {
                    try { focusTarget.RequestInitialFocus(); } catch { }
                }

                window.Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(Request));
                window.Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(Request));
            }
        }
        catch
        {
            // ignore
        }
    }

    private static DependencyObject? TryGetContentRoot(Window window)
    {
        try
        {
            var rootHost = window.FindName("RootHost");
            if (rootHost is ICurrentContentRootProvider provider)
            {
                return provider.TryGetCurrentContentRoot();
            }
            if (rootHost is Views.StableContentHost stable)
            {
                return stable.TryGetCurrentContentRoot();
            }

            if (rootHost is not ContentControl host)
            {
                return null;
            }

            if (host.Content is DependencyObject direct && PresentationSource.FromDependencyObject(direct) != null)
            {
                return direct;
            }

            if (FindDescendant<ContentPresenter>(host) is ContentPresenter presenter)
            {
                var children = VisualTreeHelper.GetChildrenCount(presenter);
                if (children > 0)
                {
                    return VisualTreeHelper.GetChild(presenter, 0);
                }
            }

            if (host.Content != null &&
                FindDescendant<FrameworkElement>(host, fe =>
                    !ReferenceEquals(fe, host) &&
                    fe is not ContentPresenter &&
                    ReferenceEquals(fe.DataContext, host.Content)) is FrameworkElement dataContextRoot)
            {
                return dataContextRoot;
            }
        }
        catch
        {
            // best-effort
        }

        return null;
    }

    private static bool IsDescendantOrSelf(DependencyObject child, DependencyObject root)
    {
        for (DependencyObject? current = child; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, root))
            {
                return true;
            }
        }

        return false;
    }

    private static DependencyObject? GetParent(DependencyObject current)
    {
        try
        {
            if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
            // ignore
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }

    private static T? FindDescendant<T>(DependencyObject root, Func<T, bool>? predicate = null) where T : DependencyObject
    {
        try
        {
            var childrenCount = VisualTreeHelper.GetChildrenCount(root);
            for (var i = 0; i < childrenCount; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child == null)
                {
                    continue;
                }

                if (child is T typed && (predicate?.Invoke(typed) ?? true))
                {
                    return typed;
                }

                if (FindDescendant(child, predicate) is T found)
                {
                    return found;
                }
            }
        }
        catch
        {
            // best-effort
        }

        return null;
    }

    private void EnsureCatalogCloseNavigatesSomewhere(CatalogViewModel catalog, CatalogEscapeResult result)
    {
        if (result != CatalogEscapeResult.Closed)
        {
            return;
        }

        // Safety net: some tavern instances can be created as fallbacks (e.g. from a table exit) where the close
        // delegate may be a no-op (no previous content). If closing the tavern doesn't change CurrentContent, force
        // navigation back to the stored HomeContent (main menu) so Escape never traps the user.
        _ = Application.Current?.Dispatcher?.BeginInvoke(
            DispatcherPriority.ApplicationIdle,
            new Action(() =>
            {
                try
                {
                    if (!ReferenceEquals(_navigation.CurrentContent, catalog))
                    {
                        return;
                    }

                    var home = _home.HomeContent;
                    if (home == null || ReferenceEquals(home, catalog))
                    {
                        return;
                    }

                    _navigation.Show(home);
                }
                catch
                {
                    // ignore
                }
            }));
    }
}
