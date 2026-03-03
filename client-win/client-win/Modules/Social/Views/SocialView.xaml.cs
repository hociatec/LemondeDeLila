using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Social.ViewModels;
using client_win.Core;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Social.Views;

public partial class SocialView : UserControl, IInitialFocusTarget
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
    private Action? _returnToMenuHandler;

    public SocialView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    private void ReturnToMenu()
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => SetScreen(SocialScreen.Menu, FocusPolicyReason.UserRequest)));
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        // IMPORTANT (NVDA): ne pas attendre les appels async avant de placer le focus,
        // sinon WPF peut donner le focus au premier élément Focusable (ex: "Aucun ami").
        await Dispatcher.InvokeAsync(() =>
        {
            // UX: en arrivant dans Social, le focus doit être sur le 1er item (Messagerie).
            _lastMenuIndex = 0;
            SetScreen(SocialScreen.Menu, FocusPolicyReason.InitialLoad);
        }, DispatcherPriority.Input);

        if (DataContext is SocialViewModel vm)
        {
            HookProfileFocusRequests(vm);
            _ = InitializeVmAsync(vm);
        }
    }

    private static async Task InitializeVmAsync(SocialViewModel vm)
    {
        try
        {
            await vm.InitializeAsync().ConfigureAwait(true);
        }
        catch
        {
            // Best-effort: éviter une exception non gérée qui bloquerait l'UI.
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
        if (_focusVm != null && _returnToMenuHandler != null)
        {
            _focusVm.ReturnToMenuRequested -= _returnToMenuHandler;
        }

        _focusVm = vm;
        _profileFocusHandler = null;
        _returnToMenuHandler = null;

        if (_focusVm == null)
        {
            return;
        }

        _profileFocusHandler = () =>
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                SetScreen(SocialScreen.Section, FocusPolicyReason.UserRequest);
                FocusSection(SocialSection.Profile, FocusPolicyReason.UserRequest);
            }));
        };

        _focusVm.ProfileFocusRequested += _profileFocusHandler;

        _returnToMenuHandler = () => ReturnToMenu();
        _focusVm.ReturnToMenuRequested += _returnToMenuHandler;
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

        e.Handled = true;
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            try
            {
                if (_currentScreen == SocialScreen.Section)
                {
                    if (vm.SelectedSection == SocialSection.Profile && vm.TryExitProfile(out var returnSection))
                    {
                        vm.SelectedSection = returnSection;
                        FocusSection(returnSection, FocusPolicyReason.UserRequest);
                        return;
                    }

                    SetScreen(SocialScreen.Menu, FocusPolicyReason.UserRequest);
                    return;
                }

                vm.CloseCommand.Execute(null);
            }
            catch
            {
                // best-effort
            }
        }));
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

    private void OnProfileConfigMenuKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            ActivateProfileConfigSelection();
            e.Handled = true;
        }
    }

    private void OnProfileConfigMenuClick(object sender, MouseButtonEventArgs e)
    {
        ActivateProfileConfigSelection();
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
                SetScreen(SocialScreen.Section, FocusPolicyReason.UserRequest);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "incoming":
                vm.SelectedSection = SocialSection.IncomingRequests;
                SetScreen(SocialScreen.Section, FocusPolicyReason.UserRequest);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "outgoing":
                vm.SelectedSection = SocialSection.OutgoingRequests;
                SetScreen(SocialScreen.Section, FocusPolicyReason.UserRequest);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "blocked":
                vm.SelectedSection = SocialSection.Blocked;
                SetScreen(SocialScreen.Section, FocusPolicyReason.UserRequest);
                await FocusSectionWhenReadyAsync(vm.SelectedSection).ConfigureAwait(true);
                break;
            case "search":
                vm.SelectedSection = SocialSection.Search;
                SetScreen(SocialScreen.Section, FocusPolicyReason.UserRequest);
                FocusSection(vm.SelectedSection, FocusPolicyReason.UserRequest);
                break;
            case "profile":
                vm.EnterOwnProfile();
                vm.SelectedSection = SocialSection.Profile;
                SetScreen(SocialScreen.Section, FocusPolicyReason.UserRequest);
                FocusSection(vm.SelectedSection, FocusPolicyReason.UserRequest);
                break;
        }
    }

    private async Task FocusSectionWhenReadyAsync(SocialSection section)
    {
        FocusSection(section, FocusPolicyReason.UserRequest);
        await Task.CompletedTask.ConfigureAwait(true);
    }

    private void ActivateProfileConfigSelection()
    {
        if (DataContext is not SocialViewModel vm || ProfileConfigMenu.SelectedItem is not ListBoxItem item)
        {
            return;
        }

        var tag = item.Tag as string ?? string.Empty;
        switch (tag)
        {
            case "bio":
                vm.OpenProfileEditor(ProfileEditorMode.Bio);
                break;
            case "victory":
                vm.OpenProfileEditor(ProfileEditorMode.VictoryMessage);
                break;
            case "defeat":
                vm.OpenProfileEditor(ProfileEditorMode.DefeatMessage);
                break;
            case "visibility":
                vm.OpenProfileEditor(ProfileEditorMode.Visibility);
                break;
            default:
                return;
        }

        FocusSection(SocialSection.Profile, FocusPolicyReason.UserRequest);
    }

    private void SetScreen(SocialScreen screen, FocusPolicyReason reason)
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
            FocusMenu(reason);
        }
    }

    private void FocusSection(SocialSection section, FocusPolicyReason reason)
    {
        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        _ = Dispatcher.InvokeAsync(() =>
        {
            switch (section)
            {
                case SocialSection.Friends:
                    FocusListOrEmpty(FriendsList, EmptyFriendsText, reason);
                    break;
                case SocialSection.IncomingRequests:
                    FocusListOrEmpty(IncomingList, EmptyIncomingText, reason);
                    break;
                case SocialSection.OutgoingRequests:
                    FocusListOrEmpty(OutgoingList, EmptyOutgoingText, reason);
                    break;
                case SocialSection.Blocked:
                    FocusListOrEmpty(BlockedList, EmptyBlockedText, reason);
                    break;
                case SocialSection.Search:
                    SearchBox.Focus();
                    break;
                case SocialSection.Profile:
                    if (DataContext is SocialViewModel profileVm)
                    {
                        if (profileVm.IsProfileEditorMenuVisible && ProfileConfigMenu.IsVisible && ProfileConfigMenu.IsEnabled)
                        {
                            FocusListOrFallback(ProfileConfigMenu, ProfileInfoBox, reason);
                            break;
                        }

                        if (profileVm.IsProfileBioEditorVisible && ProfileBioBox.IsVisible && ProfileBioBox.IsEnabled)
                        {
                            ProfileBioBox.Focus();
                            break;
                        }

                        if (profileVm.IsProfileVictoryEditorVisible && ProfileVictoryMessageBox.IsVisible && ProfileVictoryMessageBox.IsEnabled)
                        {
                            ProfileVictoryMessageBox.Focus();
                            break;
                        }

                        if (profileVm.IsProfileDefeatEditorVisible && ProfileDefeatMessageBox.IsVisible && ProfileDefeatMessageBox.IsEnabled)
                        {
                            ProfileDefeatMessageBox.Focus();
                            break;
                        }

                        if (profileVm.IsProfileVisibilityEditorVisible && VisibilityBox.IsVisible && VisibilityBox.IsEnabled)
                        {
                            VisibilityBox.Focus();
                            break;
                        }
                    }

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

    private void FocusMenu(FocusPolicyReason reason)
    {
        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        FocusListOrFallback(MenuList, MenuList, reason);
    }

    private void OnMenuSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (MenuList.SelectedIndex >= 0)
        {
            _lastMenuIndex = MenuList.SelectedIndex;
        }
    }

    private async void OnOutgoingListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }

        if (DataContext is not SocialViewModel vm)
        {
            return;
        }

        // UX: dans "Demandes envoyées", Entrée annule la demande sélectionnée.
        if (vm.CancelRequestCommand is AsyncRelayCommand asyncCmd)
        {
            e.Handled = true;
            await asyncCmd.ExecuteAsync(null).ConfigureAwait(true);
            return;
        }

        if (vm.CancelRequestCommand.CanExecute(null))
        {
            e.Handled = true;
            vm.CancelRequestCommand.Execute(null);
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

    private void FocusListOrEmpty(ListBox listBox, TextBlock emptyText, FocusPolicyReason reason)
    {
        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        if (listBox.Items.Count == 0)
        {
            emptyText.Focus();
            return;
        }

        FocusListOrFallback(listBox, emptyText, reason);
    }

    private void FocusListOrFallback(ListBox listBox, UIElement fallback, FocusPolicyReason reason)
    {
        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        if (listBox.Items.Count == 0)
        {
            fallback.Focus();
            return;
        }

        if (listBox.SelectedIndex < 0)
        {
            listBox.SelectedIndex = 0;
        }

        var index = listBox.SelectedIndex;
        if (index >= 0 && index < listBox.Items.Count)
        {
            listBox.ScrollIntoView(listBox.Items[index]);
        }

        if (index >= 0 && listBox.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            return;
        }

        listBox.Focus();
    }

    public void RequestInitialFocus()
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            _lastMenuIndex = 0;
            SetScreen(SocialScreen.Menu, FocusPolicyReason.InitialLoad);
        }));
    }
}
