using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Messaging.Models;
using client_win.Modules.Messaging.ViewModels;

namespace client_win.Modules.Messaging.Views;

public partial class MessagingView : UserControl
{
    private enum MessagingScreen
    {
        Menu,
        List,
        Detail,
        Compose
    }

    private MessagingScreen _currentScreen = MessagingScreen.Menu;

    public MessagingView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is MessagingViewModel vm)
        {
            await vm.InitializeAsync();
        }

        await Dispatcher.InvokeAsync(() =>
        {
            if (MenuList.Items.Count > 0)
            {
                MenuList.SelectedIndex = 0;
            }
            ShowScreen(MessagingScreen.Menu);
        }, DispatcherPriority.Input);
    }

    private void OnRootKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not MessagingViewModel vm)
        {
            return;
        }

        if (_currentScreen == MessagingScreen.Detail && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control)
        {
            if (e.Key == Key.R)
            {
                vm.RestoreCommand.Execute(null);
                e.Handled = true;
                return;
            }

            if (e.Key == Key.D)
            {
                vm.DeleteCommand.Execute(null);
                e.Handled = true;
                return;
            }
        }

        if (e.Key != Key.Escape)
        {
            return;
        }

        switch (_currentScreen)
        {
            case MessagingScreen.Detail:
                ShowScreen(MessagingScreen.List);
                break;
            case MessagingScreen.List:
                ShowScreen(MessagingScreen.Menu);
                break;
            case MessagingScreen.Compose:
                vm.IsComposeMode = false;
                ShowScreen(MessagingScreen.Menu);
                break;
            default:
                vm.CloseCommand.Execute(null);
                break;
        }

        e.Handled = true;
    }

    private void ShowScreen(MessagingScreen screen)
    {
        _currentScreen = screen;
        MenuPanel.Visibility = screen == MessagingScreen.Menu ? Visibility.Visible : Visibility.Collapsed;
        ListPanel.Visibility = screen == MessagingScreen.List ? Visibility.Visible : Visibility.Collapsed;
        DetailPanel.Visibility = screen == MessagingScreen.Detail ? Visibility.Visible : Visibility.Collapsed;
        ComposePanelContainer.Visibility = screen == MessagingScreen.Compose ? Visibility.Visible : Visibility.Collapsed;

        if (DataContext is MessagingViewModel vm)
        {
            vm.IsComposeMode = screen == MessagingScreen.Compose;
        }

        _ = Dispatcher.InvokeAsync(() =>
        {
            switch (screen)
            {
                case MessagingScreen.Menu:
                    if (MenuList.Items.Count > 0 && MenuList.SelectedIndex < 0)
                    {
                        MenuList.SelectedIndex = 0;
                    }
                    FocusListItem(MenuList);
                    break;
                case MessagingScreen.List:
                    if (MessagesList.Items.Count > 0 && MessagesList.SelectedIndex < 0)
                    {
                        MessagesList.SelectedIndex = 0;
                    }
                    FocusListItem(MessagesList);
                    break;
                case MessagingScreen.Detail:
                    DetailBody.Focus();
                    break;
                case MessagingScreen.Compose:
                    ComposePanel.FocusFirstField();
                    break;
            }
        }, DispatcherPriority.Input);
    }

    private static void FocusListItem(ListBox listBox)
    {
        listBox.UpdateLayout();
        if (listBox.Items.Count == 0)
        {
            listBox.Focus();
            return;
        }

        var index = listBox.SelectedIndex >= 0 ? listBox.SelectedIndex : 0;
        listBox.ScrollIntoView(listBox.Items[index]);
        var container = listBox.ItemContainerGenerator.ContainerFromIndex(index) as ListBoxItem;
        if (container != null)
        {
            container.Focus();
            return;
        }

        listBox.Focus();
    }

    private void OnMenuKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            ActivateMenuSelection();
            e.Handled = true;
        }
    }

    private void OnMenuClick(object sender, MouseButtonEventArgs e)
    {
        ActivateMenuSelection();
    }

    private void ActivateMenuSelection()
    {
        if (DataContext is not MessagingViewModel vm || MenuList.SelectedItem is not ListBoxItem item)
        {
            return;
        }

        var tag = item.Tag as string ?? string.Empty;
        switch (tag)
        {
            case "compose":
                vm.IsComposeMode = true;
                ShowScreen(MessagingScreen.Compose);
                break;
            case "inbox":
                vm.IsComposeMode = false;
                vm.SelectedBox = MessagingBox.Inbox;
                ShowScreen(MessagingScreen.List);
                break;
            case "outbox":
                vm.IsComposeMode = false;
                vm.SelectedBox = MessagingBox.Outbox;
                ShowScreen(MessagingScreen.List);
                break;
            case "deleted":
                vm.IsComposeMode = false;
                vm.SelectedBox = MessagingBox.Deleted;
                ShowScreen(MessagingScreen.List);
                break;
        }
    }

    private void OnMessagesKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            OpenMessageDetail();
            e.Handled = true;
        }
    }

    private void OnMessagesDoubleClick(object sender, MouseButtonEventArgs e)
    {
        OpenMessageDetail();
    }

    private void OpenMessageDetail()
    {
        if (DataContext is not MessagingViewModel vm)
        {
            return;
        }

        if (vm.SelectedMessage == null)
        {
            return;
        }

        ShowScreen(MessagingScreen.Detail);
    }
}
