using System;
using System.Collections.Specialized;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using client_win.Modules.Game.Play.ViewModels;

namespace client_win.Modules.Game.Play.Views;

public partial class GamePlayView : UserControl
{
    private GamePlayViewModel? _vm;
    private INotifyCollectionChanged? _choicesCollection;
    private NotifyCollectionChangedEventHandler? _choicesChanged;
    private Action? _focusRequestedHandler;
    private CancellationTokenSource? _initCts;
    private GamePlayViewModel? _initVm;
    private int _gridFocusIndex;
    private EventHandler? _gridGeneratorStatusChanged;

    public GamePlayView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        UpdateChoicesAccessibility();
        var vm = DataContext as GamePlayViewModel;
        HookChoiceAutoFocus(vm);
        TryStartInitialization(vm);
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        var vm = DataContext as GamePlayViewModel;
        HookChoiceAutoFocus(vm);
        TryStartInitialization(vm);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        HookChoiceAutoFocus(null);
        CancelInitialization();
        UnhookGridGenerator();
    }

    private void OnGridLoaded(object sender, RoutedEventArgs e)
    {
        HookGridGenerator();
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            TryFocusPreferredGridCell();
        }));
    }

    private void HookGridGenerator()
    {
        UnhookGridGenerator();
        _gridGeneratorStatusChanged = (_, __) =>
        {
            if (GridItems.ItemContainerGenerator.Status != GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                TryFocusPreferredGridCell();
            }));
        };
        GridItems.ItemContainerGenerator.StatusChanged += _gridGeneratorStatusChanged;
    }

    private void UnhookGridGenerator()
    {
        if (_gridGeneratorStatusChanged != null)
        {
            try
            {
                GridItems.ItemContainerGenerator.StatusChanged -= _gridGeneratorStatusChanged;
            }
            catch
            {
                // best-effort
            }
            _gridGeneratorStatusChanged = null;
        }
    }

    private void TryStartInitialization(GamePlayViewModel? vm)
    {
        if (vm == null)
        {
            return;
        }

        if (ReferenceEquals(_initVm, vm))
        {
            return;
        }

        CancelInitialization();
        _initVm = vm;
        _initCts = new CancellationTokenSource();
        var expectedVm = vm;
        var expectedToken = _initCts.Token;

        // IMPORTANT: démarrer après le rendu initial pour éviter une sensation de "lag" à l'ouverture.
        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (expectedToken.IsCancellationRequested || !ReferenceEquals(_initVm, expectedVm))
            {
                return;
            }

            _ = InitializeVmAsync(expectedVm, expectedToken);
        }));
    }

    private void CancelInitialization()
    {
        try
        {
            _initCts?.Cancel();
        }
        catch
        {
            // Best-effort
        }

        _initCts?.Dispose();
        _initCts = null;
        _initVm = null;
    }

    private static async System.Threading.Tasks.Task InitializeVmAsync(GamePlayViewModel vm, CancellationToken cancellationToken)
    {
        try
        {
            await vm.InitializeAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // ignore
        }
        catch
        {
            // Best-effort: l'état de connexion est déjà exposé dans le ViewModel.
        }
    }

    private void HookChoiceAutoFocus(GamePlayViewModel? vm)
    {
        if (_choicesCollection != null && _choicesChanged != null)
        {
            _choicesCollection.CollectionChanged -= _choicesChanged;
        }

        if (_vm != null && _focusRequestedHandler != null)
        {
            _vm.GameZoneFocusRequested -= _focusRequestedHandler;
        }

        _vm = vm;
        _choicesCollection = null;
        _choicesChanged = null;
        _focusRequestedHandler = null;

        if (_vm != null)
        {
            _focusRequestedHandler = () =>
            {
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    ForceFocusGameZone();
                }));
            };
            _vm.GameZoneFocusRequested += _focusRequestedHandler;
        }

        if (vm?.PendingChoices is not INotifyCollectionChanged notify)
        {
            return;
        }

        _choicesCollection = notify;
        _choicesChanged = (_, __) =>
        {
            if (_vm == null)
            {
                return;
            }

            UpdateChoicesAccessibility();

            if (_vm.PendingChoices.Count <= 0)
            {
                if (ChoicesList.IsKeyboardFocusWithin)
                {
                    Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        ForceFocusGameZone();
                    }));
                }
                return;
            }

            // Ne pas voler le focus si l'utilisateur est dans une zone de saisie/lecture (ex: historique).
            if (IsTextInputFocused())
            {
                return;
            }

            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                TryFocusFirstChoice();
            }));
        };

        notify.CollectionChanged += _choicesChanged;
    }

    private void UpdateChoicesAccessibility()
    {
        if (_vm == null)
        {
            return;
        }

        var label = string.IsNullOrWhiteSpace(_vm.ChoicesLabel) ? string.Empty : _vm.ChoicesLabel.Trim();

        // NVDA utilise parfois LabeledBy plutôt que Name.
        // On force un libellé serveur (pending.label) et on évite HelpText (valeurs vides/null peuvent provoquer une erreur WPF).
        // On efface aussi tout HelpText défini via XAML/BAML (anciennes versions) pour éviter les annonces génériques.
        ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
        if (string.IsNullOrWhiteSpace(label))
        {
            ChoicesList.ClearValue(AutomationProperties.NameProperty);
        }
        else
        {
            AutomationProperties.SetName(ChoicesList, label);
        }

        // NOTE: On récupère le label via FindName pour éviter une dépendance au champ généré par le XAML,
        // qui peut ne pas être régénéré dans certains scénarios (build incrémentale / cache).
        if (FindName("ChoicesLabelText") is FrameworkElement labelElement)
        {
            AutomationProperties.SetName(labelElement, label);
            AutomationProperties.SetLabeledBy(ChoicesList, labelElement);
        }
    }

    private bool IsTextInputFocused()
    {
        var focused = Keyboard.FocusedElement;
        return focused is TextBoxBase ||
               focused is PasswordBox ||
               focused is RichTextBox;
    }

    private void TryFocusFirstChoice()
    {
        if (_vm == null)
        {
            return;
        }

        if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count == 0)
        {
            return;
        }

        if (ChoicesList.SelectedIndex < 0)
        {
            ChoicesList.SelectedIndex = 0;
        }

        ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
        ChoicesList.UpdateLayout();

        if (ChoicesList.ItemContainerGenerator.ContainerFromIndex(0) is ListBoxItem firstItem)
        {
            firstItem.Focus();
            Keyboard.Focus(firstItem);
            return;
        }

        // Fallback: focus la liste, puis on retente après layout pour que le container existe.
        ChoicesList.Focus();
        Keyboard.Focus(ChoicesList);
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            if (ChoicesList.ItemContainerGenerator.ContainerFromIndex(0) is ListBoxItem item)
            {
                item.Focus();
                Keyboard.Focus(item);
            }
        }));
    }

    private void ForceFocusGameZone()
    {
        // Le reset d'une table peut "casser" le focus (l'élément focusé est détruit/collapsé),
        // ce qui oblige ensuite à Tab/Maj+Tab. Ici on force un ancrage stable sur la zone de jeu.
        if (IsTextInputFocused())
        {
            return;
        }

        Focus();
        Keyboard.Focus(this);

        // Si une grille est affichée, on ancre le focus sur une case (sinon les flèches ne déplacent rien).
        TryFocusPreferredGridCell();
    }

    private async void OnRootPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.M)
        {
            if (DataContext is not GamePlayViewModel vm || !vm.ShowGridBoard)
            {
                return;
            }

            var cell = GetFocusedGridCell();
            if (cell == null)
            {
                TryFocusPreferredGridCell();
                cell = GetFocusedGridCell();
            }

            if (cell != null)
            {
                e.Handled = true;
                try
                {
                    await vm.HandleGridWallHotkeyAsync(cell).ConfigureAwait(true);
                }
                catch
                {
                    // ignore
                }
                return;
            }
        }

        HandleGridArrowKey(e);
    }

    private void OnGridPreviewKeyDown(object sender, KeyEventArgs e)
    {
        HandleGridArrowKey(e);
    }

    private void HandleGridArrowKey(KeyEventArgs e)
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }
        if (!vm.ShowGridBoard || vm.GridSize <= 0 || vm.GridCells.Count == 0)
        {
            return;
        }

        // Quand le focus n'est pas déjà dans une case, la première flèche doit amener sur la grille.
        if (e.Key is Key.Left or Key.Right or Key.Up or Key.Down)
        {
            var focused = GetFocusedGridCell();
            if (focused == null)
            {
                // Même si les containers ne sont pas encore générés, on consomme la touche
                // et on planifie un focus sur la grille (sinon le focus WPF tombe sur un "data item").
                TryFocusPreferredGridCell();
                e.Handled = true;
                return;
            }

            var x = focused.X;
            var y = focused.Y;
            switch (e.Key)
            {
                case Key.Left: x--; break;
                case Key.Right: x++; break;
                case Key.Up: y--; break;
                case Key.Down: y++; break;
            }

            x = Math.Clamp(x, 0, vm.GridSize - 1);
            y = Math.Clamp(y, 0, vm.GridSize - 1);
            var idx = y * vm.GridSize + x;
            if (FocusGridCellIndex(idx))
            {
                e.Handled = true;
            }
        }
    }

    private bool TryFocusPreferredGridCell()
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return false;
        }
        if (!vm.ShowGridBoard || vm.GridSize <= 0 || vm.GridCells.Count == 0)
        {
            return false;
        }

        var preferred = vm.GridCells.FirstOrDefault(c => c.IsOwnPawn) ?? vm.GridCells.FirstOrDefault();
        var idx = preferred?.Index ?? 0;
        if (idx < 0 || idx >= vm.GridCells.Count)
        {
            idx = 0;
        }
        return FocusGridCellIndex(idx);
    }

    private GridCellViewModel? GetFocusedGridCell()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (focused is FrameworkElement fe && fe.DataContext is GridCellViewModel cell)
            {
                _gridFocusIndex = cell.Index;
                return cell;
            }
            focused = VisualTreeHelper.GetParent(focused);
        }
        return null;
    }

    private bool FocusGridCellIndex(int index)
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return false;
        }
        if (index < 0 || index >= vm.GridCells.Count)
        {
            return false;
        }

        _gridFocusIndex = index;

        GridItems.UpdateLayout();
        var container = GridItems.ItemContainerGenerator.ContainerFromIndex(index) as DependencyObject;
        if (container == null)
        {
            // Fallback: retente après layout, sinon aucune annonce.
            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                FocusGridCellIndex(_gridFocusIndex);
            }));
            return true;
        }

        var button = FindVisualChild<Button>(container) ?? container as Button;
        if (button == null)
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                FocusGridCellIndex(_gridFocusIndex);
            }));
            return true;
        }

        button.Focus();
        Keyboard.Focus(button);
        return true;
    }

    private static T? FindVisualChild<T>(DependencyObject parent) where T : DependencyObject
    {
        var count = VisualTreeHelper.GetChildrenCount(parent);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T typed) return typed;
            var sub = FindVisualChild<T>(child);
            if (sub != null) return sub;
        }
        return null;
    }

    private async void OnChoicesKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter)
        {
            return;
        }
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }
        // Le ListBox de quiz doit "consommer" Enter pour envoyer la réponse sélectionnée,
        // afin de ne pas déclencher le raccourci global Enter (roll).
        try
        {
            bool sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
            if (sent)
            {
                e.Handled = true;
                Focus();
                Keyboard.Focus(this);
            }
        }
        catch
        {
            e.Handled = true;
        }
    }
}
