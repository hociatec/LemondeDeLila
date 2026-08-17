using System;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;

namespace client_win.Modules.Shell.Controls;

public partial class VerticalMenuList : System.Windows.Controls.UserControl
{
    private static readonly DependencyProperty ItemsSourceProperty =
        DependencyProperty.Register(
            nameof(ItemsSource),
            typeof(System.Collections.IEnumerable),
            typeof(VerticalMenuList),
            new PropertyMetadata(null));

    private static readonly DependencyProperty SelectedItemProperty =
        DependencyProperty.Register(
            nameof(SelectedItem),
            typeof(object),
            typeof(VerticalMenuList),
            new FrameworkPropertyMetadata(
                null,
                FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    private static readonly DependencyProperty SelectedIndexProperty =
        DependencyProperty.Register(
            nameof(SelectedIndex),
            typeof(int),
            typeof(VerticalMenuList),
            new FrameworkPropertyMetadata(-1, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    private static readonly DependencyProperty DisplayMemberPathProperty =
        DependencyProperty.Register(
            nameof(DisplayMemberPath),
            typeof(string),
            typeof(VerticalMenuList),
            new PropertyMetadata(string.Empty));

    private static readonly DependencyProperty ItemTemplateProperty =
        DependencyProperty.Register(
            nameof(ItemTemplate),
            typeof(DataTemplate),
            typeof(VerticalMenuList),
            new PropertyMetadata(null));

    public VerticalMenuList()
    {
        InitializeComponent();
    }

    public event SelectionChangedEventHandler? SelectionChanged;

    public System.Collections.IEnumerable? ItemsSource
    {
        get => (System.Collections.IEnumerable?)GetValue(ItemsSourceProperty);
        set => SetValue(ItemsSourceProperty, value);
    }

    public object? SelectedItem
    {
        get => GetValue(SelectedItemProperty);
        set => SetValue(SelectedItemProperty, value);
    }

    public int SelectedIndex
    {
        get => (int)GetValue(SelectedIndexProperty);
        set => SetValue(SelectedIndexProperty, value);
    }

    public string DisplayMemberPath
    {
        get => (string)GetValue(DisplayMemberPathProperty);
        set => SetValue(DisplayMemberPathProperty, value);
    }

    public DataTemplate? ItemTemplate
    {
        get => (DataTemplate?)GetValue(ItemTemplateProperty);
        set => SetValue(ItemTemplateProperty, value);
    }

    public ItemCollection Items => MenuList.Items;

    public ItemContainerGenerator ItemContainerGenerator => MenuList.ItemContainerGenerator;

    public bool HasItems => MenuList.HasItems;

    private long _lastAutoFocusTicks;

    private void OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        SelectionChanged?.Invoke(this, e);
    }

    private void OnListGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (ReferenceEquals(e.NewFocus, MenuList))
        {
            var now = Stopwatch.GetTimestamp();
            if (_lastAutoFocusTicks != 0 && now - _lastAutoFocusTicks < Stopwatch.Frequency)
            {
                return;
            }

            _lastAutoFocusTicks = now;
            _ = Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Input, new Action(FocusSelectedItem));
            return;
        }

        var focused = e.NewFocus as DependencyObject;
        if (focused == null)
        {
            return;
        }

        if (ItemsControl.ContainerFromElement(MenuList, focused) is ListBoxItem container &&
            container.DataContext != null &&
            !ReferenceEquals(MenuList.SelectedItem, container.DataContext))
        {
            MenuList.SelectedItem = container.DataContext;
        }
    }

    private void OnListPreviewGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (e.NewFocus is not DependencyObject focused)
        {
            return;
        }

        var container = ItemsControl.ContainerFromElement(MenuList, focused) as ListBoxItem;
        if (container?.DataContext == null)
        {
            return;
        }

        if (!ReferenceEquals(MenuList.SelectedItem, container.DataContext))
        {
            MenuList.SelectedItem = container.DataContext;
        }
    }

    public bool MoveSelectionBy(bool forward)
    {
        if (MenuList.Items.Count == 0)
        {
            return false;
        }

        var current = MenuList.SelectedIndex;
        if (current < 0)
        {
            current = 0;
        }

        var next = forward ? current + 1 : current - 1;
        if (next < 0 || next >= MenuList.Items.Count)
        {
            return false;
        }

        MenuList.SelectedIndex = next;
        FocusSelectedItem();
        return true;
    }

    public void SelectLastIfEmpty()
    {
        if (MenuList.SelectedIndex < 0 && MenuList.Items.Count > 0)
        {
            MenuList.SelectedIndex = 0;
            FocusSelectedItem();
        }
    }

    public void FocusSelectedItem()
    {
        if (!MenuList.HasItems)
        {
            MenuList.Focus();
            Keyboard.Focus(MenuList);
            return;
        }

        if (MenuList.SelectedIndex < 0)
        {
            MenuList.SelectedIndex = 0;
        }

        var index = MenuList.SelectedIndex;
        if (index >= 0 && index < MenuList.Items.Count)
        {
            MenuList.ScrollIntoView(MenuList.Items[index]);
        }

        if (index >= 0 && MenuList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            Keyboard.Focus(item);
            return;
        }

        MenuList.Focus();
        Keyboard.Focus(MenuList);
    }

    public ListBoxItem? GetItemContainer(int index)
    {
        if (index < 0 || index >= MenuList.Items.Count)
        {
            return null;
        }

        return MenuList.ItemContainerGenerator.ContainerFromIndex(index) as ListBoxItem;
    }
}
