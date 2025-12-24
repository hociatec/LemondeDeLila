using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Social.ViewModels;

namespace client_win.Modules.Social.Views;

public partial class SocialView : UserControl
{
    private enum SocialScreen
    {
        Menu,
        Section
    }

    private SocialScreen _currentScreen = SocialScreen.Menu;
    private int _lastMenuIndex = 0;

    public SocialView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is SocialViewModel vm)
        {
            await vm.InitializeAsync();
        }

        await Dispatcher.InvokeAsync(() =>
        {
            if (MenuList.Items.Count > 0)
            {
                MenuList.SelectedIndex = 0;
            }
            SetScreen(SocialScreen.Menu);
        }, DispatcherPriority.Input);
    }

    private void OnRootKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab && _currentScreen == SocialScreen.Menu)
        {
            e.Handled = true;
            return;
        }

        if (e.Key != Key.Escape || DataContext is not SocialViewModel vm)
        {
            return;
        }

        if (_currentScreen == SocialScreen.Section)
        {
            SetScreen(SocialScreen.Menu);
            e.Handled = true;
            return;
        }

        vm.CloseCommand.Execute(null);
        e.Handled = true;
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
        if (DataContext is not SocialViewModel vm || MenuList.SelectedItem is not ListBoxItem item)
        {
            return;
        }

        var tag = item.Tag as string ?? string.Empty;
        switch (tag)
        {
            case "friends":
                vm.SelectedSection = SocialSection.Friends;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
            case "incoming":
                vm.SelectedSection = SocialSection.IncomingRequests;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
            case "outgoing":
                vm.SelectedSection = SocialSection.OutgoingRequests;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
            case "blocked":
                vm.SelectedSection = SocialSection.Blocked;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
            case "search":
                vm.SelectedSection = SocialSection.Search;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
            case "profile":
                vm.SelectedSection = SocialSection.Profile;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
        }
    }

    private void SetScreen(SocialScreen screen)
    {
        _currentScreen = screen;
        if (screen == SocialScreen.Menu)
        {
            if (MenuList.Items.Count > 0)
            {
                MenuList.SelectedIndex = _lastMenuIndex < MenuList.Items.Count ? _lastMenuIndex : 0;
            }
            FocusMenu();
        }
    }

    private void FocusSection(SocialSection section)
    {
        _ = Dispatcher.InvokeAsync(() =>
        {
            switch (section)
            {
                case SocialSection.Friends:
                    FocusListOrEmpty(FriendsList, EmptyFriendsText);
                    break;
                case SocialSection.IncomingRequests:
                    FocusListOrEmpty(IncomingList, EmptyIncomingText);
                    break;
                case SocialSection.OutgoingRequests:
                    FocusListOrEmpty(OutgoingList, EmptyOutgoingText);
                    break;
                case SocialSection.Blocked:
                    FocusListOrEmpty(BlockedList, EmptyBlockedText);
                    break;
                case SocialSection.Search:
                    SearchBox.Focus();
                    break;
                case SocialSection.Profile:
                    ProfileBioBox.Focus();
                    break;
            }
        }, DispatcherPriority.Input);
    }

    private void FocusMenu()
    {
        MenuList.UpdateLayout();
        if (MenuList.Items.Count == 0)
        {
            MenuList.Focus();
            return;
        }

        var index = MenuList.SelectedIndex >= 0 ? MenuList.SelectedIndex : 0;
        MenuList.ScrollIntoView(MenuList.Items[index]);
        if (MenuList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            return;
        }

        MenuList.Focus();
    }

    private void OnMenuSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (MenuList.SelectedIndex >= 0)
        {
            _lastMenuIndex = MenuList.SelectedIndex;
        }
    }

    private static void FocusListOrEmpty(ListBox listBox, TextBlock emptyText)
    {
        listBox.UpdateLayout();
        if (listBox.Items.Count == 0)
        {
            emptyText.Focus();
            return;
        }

        if (listBox.SelectedIndex < 0)
        {
            listBox.SelectedIndex = 0;
        }
        var index = listBox.SelectedIndex >= 0 ? listBox.SelectedIndex : 0;
        listBox.ScrollIntoView(listBox.Items[index]);
        if (listBox.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            return;
        }

        listBox.Focus();
    }
}
