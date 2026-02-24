using System;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace client_win.Core.Text;

public static class GlobalUiTextRepair
{
    private static int _initialized;

    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1)
        {
            return;
        }

        EventManager.RegisterClassHandler(
            typeof(FrameworkElement),
            FrameworkElement.LoadedEvent,
            new RoutedEventHandler(OnElementLoaded),
            handledEventsToo: true);

        MojibakeTextRepair.EnabledChanged += OnEnabledChanged;
    }

    private static void OnEnabledChanged(bool enabled)
    {
        if (!enabled)
        {
            return;
        }

        var app = Application.Current;
        if (app?.Dispatcher == null)
        {
            return;
        }

        _ = app.Dispatcher.BeginInvoke(new Action(RepairAllOpenWindows));
    }

    private static void OnElementLoaded(object sender, RoutedEventArgs _)
    {
        if (!MojibakeTextRepair.IsEnabled || sender is not DependencyObject obj)
        {
            return;
        }

        RepairNode(obj);
    }

    private static void RepairAllOpenWindows()
    {
        if (!MojibakeTextRepair.IsEnabled)
        {
            return;
        }

        foreach (Window window in Application.Current.Windows)
        {
            RepairNode(window);
        }
    }

    private static void RepairNode(DependencyObject root)
    {
        RepairSingle(root);

        var count = 0;
        try
        {
            count = VisualTreeHelper.GetChildrenCount(root);
        }
        catch
        {
            return;
        }

        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            RepairNode(child);
        }
    }

    private static void RepairSingle(DependencyObject node)
    {
        switch (node)
        {
            case Window w:
                w.Title = MojibakeTextRepair.Fix(w.Title);
                break;
            case TextBlock tb:
                tb.Text = MojibakeTextRepair.Fix(tb.Text);
                break;
            case AccessText at:
                at.Text = MojibakeTextRepair.Fix(at.Text);
                break;
            case Run run:
                run.Text = MojibakeTextRepair.Fix(run.Text);
                break;
            case TextBox textBox:
                // Preserve bindings on Text by updating the current value without replacing them.
                textBox.SetCurrentValue(TextBox.TextProperty, MojibakeTextRepair.Fix(textBox.Text));
                break;
            case ContentControl cc when cc.Content is string content:
                cc.Content = MojibakeTextRepair.Fix(content);
                break;
            case HeaderedContentControl hcc when hcc.Header is string header:
                hcc.Header = MojibakeTextRepair.Fix(header);
                break;
            case HeaderedItemsControl hic when hic.Header is string itemsHeader:
                hic.Header = MojibakeTextRepair.Fix(itemsHeader);
                break;
        }

        if (node is FrameworkElement fe)
        {
            var tip = ToolTipService.GetToolTip(fe) as string;
            if (!string.IsNullOrEmpty(tip))
            {
                ToolTipService.SetToolTip(fe, MojibakeTextRepair.Fix(tip));
            }
        }

        if (node is UIElement ui)
        {
            var name = AutomationProperties.GetName(ui);
            if (!string.IsNullOrWhiteSpace(name))
            {
                AutomationProperties.SetName(ui, MojibakeTextRepair.Fix(name));
            }
        }
    }
}
