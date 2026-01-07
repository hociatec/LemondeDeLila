using System;
using System.Threading.Tasks;
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
    private int _lastMenuIndex = -1;
    private SocialViewModel? _focusVm;
    private Action? _profileFocusHandler;

    public SocialView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        // IMPORTANT (NVDA): ne pas attendre les appels async avant de placer le focus,
        // sinon WPF peut donner le focus au premier élément Focusable (ex: "Aucun ami").
        await Dispatcher.InvokeAsync(() => SetScreen(SocialScreen.Menu), DispatcherPriority.Input);

        if (DataContext is SocialViewModel vm)
        {
            HookProfileFocusRequests(vm);
            try
            {
                await vm.InitializeAsync();
            }
            catch
            {
                // Best-effort: éviter une exception non gérée qui bloquerait l'UI.
            }
        }
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        HookProfileFocusRequests(DataContext as SocialViewModel);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        HookProfileFocusRequests(null);
    }

    private void HookProfileFocusRequests(SocialViewModel? vm)
    {
        if (_focusVm != null && _profileFocusHandler != null)
        {
            _focusVm.ProfileFocusRequested -= _profileFocusHandler;
        }

        _focusVm = vm;
        _profileFocusHandler = null;

        if (_focusVm == null)
        {
            return;
        }

        _profileFocusHandler = () =>
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                SetScreen(SocialScreen.Section);
                FocusSection(SocialSection.Profile);
            }));
        };

        _focusVm.ProfileFocusRequested += _profileFocusHandler;
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
            if (vm.SelectedSection == SocialSection.Profile && vm.TryExitProfile(out var returnSection))
            {
                vm.SelectedSection = returnSection;
                FocusSection(returnSection);
                e.Handled = true;
                return;
            }

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
            _ = ActivateMenuSelectionAsync();
            e.Handled = true;
        }
    }

    private void OnMenuClick(object sender, MouseButtonEventArgs e)
    {
        _ = ActivateMenuSelectionAsync();
    }

    private async Task ActivateMenuSelectionAsync()
    {
        if (DataContext is not SocialViewModel vm || MenuList.SelectedItem is not ListBoxItem item)
        {
            return;
        }

        _lastMenuIndex = MenuList.SelectedIndex >= 0 ? MenuList.SelectedIndex : _lastMenuIndex;
        var tag = item.Tag as string ?? string.Empty;
        switch (tag)
        {
            case "messaging":
                if (vm.OpenMessagingCommand.CanExecute(null))
                {
                    vm.OpenMessagingCommand.Execute(null);
                }
                break;
            case "friends":
                vm.SelectedSection = SocialSection.Friends;
                SetScreen(SocialScreen.Section);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "incoming":
                vm.SelectedSection = SocialSection.IncomingRequests;
                SetScreen(SocialScreen.Section);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "outgoing":
                vm.SelectedSection = SocialSection.OutgoingRequests;
                SetScreen(SocialScreen.Section);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "blocked":
                vm.SelectedSection = SocialSection.Blocked;
                SetScreen(SocialScreen.Section);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "search":
                vm.SelectedSection = SocialSection.Search;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
            case "profile":
                vm.EnterOwnProfile();
                vm.SelectedSection = SocialSection.Profile;
                SetScreen(SocialScreen.Section);
                FocusSection(vm.SelectedSection);
                break;
        }
    }

    private async Task FocusSectionWhenReadyAsync(SocialSection section)
    {
        if (DataContext is not SocialViewModel vm)
        {
            FocusSection(section);
            return;
        }

        // Évite de mettre le focus sur les textes "Aucun ..." pendant le chargement (les listes sont vidées puis remplies).
        var start = DateTime.UtcNow;
        while (vm.IsBusy && (DateTime.UtcNow - start).TotalMilliseconds < 4000)
        {
            await Task.Delay(25).ConfigureAwait(true);
        }

        FocusSection(section);
    }

    private void SetScreen(SocialScreen screen)
    {
        _currentScreen = screen;
        if (screen == SocialScreen.Menu)
        {
            if (_lastMenuIndex >= 0 && _lastMenuIndex < MenuList.Items.Count)
            {
                MenuList.SelectedIndex = _lastMenuIndex;
            }
            else if (DataContext is SocialViewModel vm)
            {
                var tag = GetMenuTagForSection(vm.SelectedSection);
                if (!SelectMenuItemByTag(tag) && MenuList.Items.Count > 0)
                {
                    MenuList.SelectedIndex = 0;
                }
            }
            else if (MenuList.Items.Count > 0)
            {
                MenuList.SelectedIndex = 0;
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
                    if (ProfileInfoBox.IsVisible && ProfileInfoBox.IsEnabled)
                    {
                        ProfileInfoBox.Focus();
                    }
                    else if (ProfileBioBox.IsVisible && ProfileBioBox.IsEnabled)
                    {
                        ProfileBioBox.Focus();
                    }
                    else
                    {
                        VisibilityBox.Focus();
                    }
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

    private static string GetMenuTagForSection(SocialSection section)
    {
        return section switch
        {
            SocialSection.Friends => "friends",
            SocialSection.IncomingRequests => "incoming",
            SocialSection.OutgoingRequests => "outgoing",
            SocialSection.Blocked => "blocked",
            SocialSection.Search => "search",
            SocialSection.Profile => "profile",
            _ => "friends"
        };
    }

    private bool SelectMenuItemByTag(string tag)
    {
        if (string.IsNullOrWhiteSpace(tag))
        {
            return false;
        }

        for (int i = 0; i < MenuList.Items.Count; i++)
        {
            if (MenuList.Items[i] is ListBoxItem item
                && string.Equals(item.Tag as string ?? string.Empty, tag, StringComparison.OrdinalIgnoreCase))
            {
                MenuList.SelectedIndex = i;
                return true;
            }
        }

        return false;
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
