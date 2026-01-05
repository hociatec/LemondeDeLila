using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomStatusBarView : UserControl
{
    public GameRoomStatusBarView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachAppActivationHooks();
        UpdateLiveSetting();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        DetachAppActivationHooks();
    }

    private void AttachAppActivationHooks()
    {
        try
        {
            if (Application.Current == null) return;
            Application.Current.Activated -= OnAppActivated;
            Application.Current.Deactivated -= OnAppDeactivated;
            Application.Current.Activated += OnAppActivated;
            Application.Current.Deactivated += OnAppDeactivated;
        }
        catch
        {
            // ignore
        }
    }

    private void DetachAppActivationHooks()
    {
        try
        {
            if (Application.Current == null) return;
            Application.Current.Activated -= OnAppActivated;
            Application.Current.Deactivated -= OnAppDeactivated;
        }
        catch
        {
            // ignore
        }
    }

    private void OnAppActivated(object? sender, EventArgs e) => UpdateLiveSetting();

    private void OnAppDeactivated(object? sender, EventArgs e) => UpdateLiveSetting();

    private void UpdateLiveSetting()
    {
        try
        {
            var live = IsAppActive() ? AutomationLiveSetting.Polite : AutomationLiveSetting.Off;
            AutomationProperties.SetLiveSetting(StatusRegion, live);
            AutomationProperties.SetLiveSetting(StatusText, live);
        }
        catch
        {
            // ignore
        }
    }

    private static bool IsAppActive()
    {
        try
        {
            var app = Application.Current;
            if (app == null) return true;
            foreach (var window in app.Windows)
            {
                if (window is Window w && w.IsActive)
                {
                    return true;
                }
            }
            return app.MainWindow == null;
        }
        catch
        {
            return true;
        }
    }
}
