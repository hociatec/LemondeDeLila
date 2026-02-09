using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Admin.ViewModels;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Admin.Views;

public partial class AdminView : UserControl, IInitialFocusTarget
{
    private AdminViewModel? _vm;
    private bool _inputsFocusTrackingAttached;
    private InputFocusSlot _lastInputFocus = InputFocusSlot.None;
    private int _focusRequestId;

    private enum InputFocusSlot
    {
        None,
        Primary,
        Secondary,
        Third,
        Fourth,
        Fifth,
    }

    public AdminView()
    {
        InitializeComponent();
        DataContextChanged += (_, __) => AttachViewModel(DataContext as AdminViewModel);
        Unloaded += (_, __) => AttachViewModel(null);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as AdminViewModel);
        AttachRootTabSuppression();
        AttachItemsKeyNavigation();
        AttachInputsFocusTracking();
        FocusWhenContainersGenerated();
        FocusBestInputIfVisible();
        FocusDetailsIfPreferred();
    }

    private void AttachViewModel(AdminViewModel? vm)
    {
        if (_vm == vm)
        {
            return;
        }

        if (_vm != null)
        {
            _vm.NavigationChanged -= OnNavigationChanged;
            // Sécurité: si un aperçu de son est en cours, l'arrêter quand la vue admin se ferme.
            _vm.StopSoundPreview();
        }

        _vm = vm;
        if (_vm != null)
        {
            _vm.NavigationChanged += OnNavigationChanged;
        }
    }

    private void OnNavigationChanged()
    {
        AttachInputsFocusTracking();
        FocusWhenContainersGenerated();
        FocusBestInputIfVisible();
        FocusDetailsIfPreferred();
    }

    private void AttachInputsFocusTracking()
    {
        if (_inputsFocusTrackingAttached || InputsView == null)
        {
            return;
        }

        _inputsFocusTrackingAttached = true;

        void Track(TextBox? box, InputFocusSlot slot)
        {
            if (box == null)
            {
                return;
            }

            box.GotKeyboardFocus += (_, __) => _lastInputFocus = slot;
        }

        Track(InputsView.PrimaryInputBox, InputFocusSlot.Primary);
        Track(InputsView.SecondaryInputTextBox, InputFocusSlot.Secondary);
        Track(InputsView.ThirdInputTextBox, InputFocusSlot.Third);
        Track(InputsView.FourthInputTextBox, InputFocusSlot.Fourth);
        Track(InputsView.FifthInputTextBox, InputFocusSlot.Fifth);
    }

    private void AttachRootTabSuppression()
    {
        PreviewKeyDown -= OnPreviewKeyDown;
        PreviewKeyDown += OnPreviewKeyDown;
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.Key != Key.Tab)
        {
            return;
        }

        if (DataContext is not AdminViewModel vm)
        {
            return;
        }

        if (vm.IsRootMenu)
        {
            // Dans le menu principal admin, éviter Tab/Maj+Tab qui déplace le focus hors de la liste.
            e.Handled = true;
        }
    }

    private void AttachItemsKeyNavigation()
    {
        if (ItemsList == null)
        {
            return;
        }

        ItemsList.PreviewKeyDown -= OnItemsListPreviewKeyDown;
        ItemsList.PreviewKeyDown += OnItemsListPreviewKeyDown;
    }

    private void OnItemsListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.Key != Key.Tab)
        {
            return;
        }

        if (DataContext is not AdminViewModel vm)
        {
            return;
        }

        if (!vm.IsTextInputVisible &&
            !vm.IsSecondaryInputVisible &&
            !vm.IsThirdInputVisible &&
            !vm.IsFourthInputVisible &&
            !vm.IsFifthInputVisible)
        {
            return;
        }

        // When a form is visible, allow Tab/Shift+Tab from the actions list to jump back to inputs.
        // This avoids getting "stuck" on the Validate item.
        var wantLast = Keyboard.Modifiers.HasFlag(ModifierKeys.Shift);
        if (wantLast)
        {
            if (vm.IsFifthInputVisible)
            {
                InputsView?.FifthInputTextBox?.Focus();
                e.Handled = true;
                return;
            }
            if (vm.IsFourthInputVisible)
            {
                InputsView?.FourthInputTextBox?.Focus();
                e.Handled = true;
                return;
            }
            if (vm.IsThirdInputVisible)
            {
                InputsView?.ThirdInputTextBox?.Focus();
                e.Handled = true;
                return;
            }
            if (vm.IsSecondaryInputVisible)
            {
                InputsView?.SecondaryInputTextBox?.Focus();
                e.Handled = true;
                return;
            }
        }

        if (vm.IsTextInputVisible)
        {
            InputsView?.PrimaryInputBox?.Focus();
            e.Handled = true;
            return;
        }
        if (vm.IsSecondaryInputVisible)
        {
            InputsView?.SecondaryInputTextBox?.Focus();
            e.Handled = true;
            return;
        }
        if (vm.IsThirdInputVisible)
        {
            InputsView?.ThirdInputTextBox?.Focus();
            e.Handled = true;
            return;
        }
        if (vm.IsFourthInputVisible)
        {
            InputsView?.FourthInputTextBox?.Focus();
            e.Handled = true;
            return;
        }
        if (vm.IsFifthInputVisible)
        {
            InputsView?.FifthInputTextBox?.Focus();
            e.Handled = true;
        }
    }

    private void FocusBestInputIfVisible()
    {
        if (DataContext is not AdminViewModel vm)
        {
            return;
        }

        if (vm.ShowClientUpdatesPanel)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => ClientUpdatesPanel?.FocusPrimaryInput()));
            return;
        }

        if (FocusLastInputIfVisible(vm))
        {
            return;
        }

        if (vm.IsTextInputVisible)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => InputsView?.PrimaryInputBox?.Focus()));
            return;
        }

        if (vm.IsSecondaryInputVisible)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => InputsView?.SecondaryInputTextBox?.Focus()));
            return;
        }

        if (vm.IsThirdInputVisible)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => InputsView?.ThirdInputTextBox?.Focus()));
            return;
        }

        if (vm.IsFourthInputVisible)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => InputsView?.FourthInputTextBox?.Focus()));
            return;
        }

        if (vm.IsFifthInputVisible)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => InputsView?.FifthInputTextBox?.Focus()));
        }
    }

    private bool FocusLastInputIfVisible(AdminViewModel vm)
    {
        switch (_lastInputFocus)
        {
            case InputFocusSlot.Primary:
                if (vm.IsTextInputVisible)
                {
                    _ = Dispatcher.BeginInvoke(
                        DispatcherPriority.Input,
                        new Action(() => InputsView?.PrimaryInputBox?.Focus()));
                    return true;
                }
                break;
            case InputFocusSlot.Secondary:
                if (vm.IsSecondaryInputVisible)
                {
                    _ = Dispatcher.BeginInvoke(
                        DispatcherPriority.Input,
                        new Action(() => InputsView?.SecondaryInputTextBox?.Focus()));
                    return true;
                }
                break;
            case InputFocusSlot.Third:
                if (vm.IsThirdInputVisible)
                {
                    _ = Dispatcher.BeginInvoke(
                        DispatcherPriority.Input,
                        new Action(() => InputsView?.ThirdInputTextBox?.Focus()));
                    return true;
                }
                break;
            case InputFocusSlot.Fourth:
                if (vm.IsFourthInputVisible)
                {
                    _ = Dispatcher.BeginInvoke(
                        DispatcherPriority.Input,
                        new Action(() => InputsView?.FourthInputTextBox?.Focus()));
                    return true;
                }
                break;
            case InputFocusSlot.Fifth:
                if (vm.IsFifthInputVisible)
                {
                    _ = Dispatcher.BeginInvoke(
                        DispatcherPriority.Input,
                        new Action(() => InputsView?.FifthInputTextBox?.Focus()));
                    return true;
                }
                break;
        }

        return false;
    }

    private void FocusDetailsIfPreferred()
    {
        if (DataContext is not AdminViewModel vm || !vm.PreferDetailsFocus)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() => FocusDetails(resetCaret: true)));
    }

    private void FocusWhenContainersGenerated()
    {
        if (ItemsList == null)
        {
            return;
        }

        if (DataContext is AdminViewModel vm && vm.PreferDetailsFocus)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => FocusDetails(resetCaret: true)));
            return;
        }

        if (ItemsList.HasItems &&
            ItemsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedItem));
            return;
        }

        EventHandler? handler = null;
        handler = (_, __) =>
        {
            if (ItemsList.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            ItemsList.ItemContainerGenerator.StatusChanged -= handler;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedItem));
        };
        ItemsList.ItemContainerGenerator.StatusChanged += handler;
    }

    private void FocusSelectedItem()
    {
        if (ItemsList == null)
        {
            return;
        }

        if (DataContext is AdminViewModel vm && vm.PreferDetailsFocus)
        {
            FocusDetails(resetCaret: false);
            return;
        }

        if (ItemsList.Items.Count == 0)
        {
            ItemsList.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        var selected = ItemsList.SelectedItem;
        if (selected != null)
        {
            ItemsList.ScrollIntoView(selected);
        }

        var requestId = unchecked(++_focusRequestId);
        FocusSelectedItemWithRetry(requestId, attemptsRemaining: 8);
    }

    private void FocusSelectedItemWithRetry(int requestId, int attemptsRemaining)
    {
        if (ItemsList == null)
        {
            return;
        }

        if (ItemsList.Items.Count == 0)
        {
            ItemsList.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        var index = ItemsList.SelectedIndex;
        if (index >= 0 && index < ItemsList.Items.Count)
        {
            ItemsList.ScrollIntoView(ItemsList.Items[index]);
        }

        if (index >= 0 && ItemsList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            return;
        }

        if (attemptsRemaining > 0 && requestId == _focusRequestId)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Loaded,
                new Action(() => FocusSelectedItemWithRetry(requestId, attemptsRemaining - 1)));
            return;
        }

        ItemsList.Focus();
    }

    public void RequestInitialFocus()
    {
        FocusWhenContainersGenerated();
        FocusBestInputIfVisible();
        FocusDetailsIfPreferred();
    }

    private void FocusDetails(bool resetCaret)
    {
        if (DataContext is AdminViewModel vm && vm.HasDetailSegments && DetailsSegmentsScroll != null)
        {
            DetailsSegmentsScroll.Focus();
            if (resetCaret)
            {
                DetailsSegmentsScroll.ScrollToTop();
            }
            return;
        }

        if (DetailsBox == null)
        {
            return;
        }

        DetailsBox.Focus();

        if (!resetCaret)
        {
            return;
        }

        // Make keyboard navigation predictable for screen readers (start reading from the top).
        DetailsBox.CaretIndex = 0;
        DetailsBox.SelectionStart = 0;
        DetailsBox.SelectionLength = 0;
        DetailsBox.ScrollToHome();
    }
}
