using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Play.Grid.ViewModels;
using client_win.Modules.Game.Play.Grid.Views;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayViewFocusTests
{
    [Fact]
    public void FocusPreferredInteractiveElement_PrioritizesHandBeforeChoices()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var window = CreateHostWindow(view);

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var handPanel = Assert.IsType<StackPanel>(view.FindName("HandPanel"));
                var handList = Assert.IsType<ListBox>(view.FindName("HandList"));
                var choicesList = Assert.IsType<ListBox>(view.FindName("ChoicesList"));

                handPanel.Visibility = Visibility.Visible;
                handList.Visibility = Visibility.Visible;
                choicesList.Visibility = Visibility.Visible;

                handList.ItemsSource = new ObservableCollection<HandCardItem>
                {
                    new("Rouge 1"),
                    new("Jaune 6"),
                };
                choicesList.ItemsSource = new ObservableCollection<ChoiceItem>
                {
                    new("Piocher"),
                    new("Passer"),
                };

                view.UpdateLayout();
                view.FocusPreferredInteractiveElement();

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(handList), dispatcher, 2200));
                Assert.False(IsFocusWithin(choicesList));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void FocusPreferredInteractiveElement_FallsBackToChoicesWhenHandUnavailable()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var window = CreateHostWindow(view);

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var handPanel = Assert.IsType<StackPanel>(view.FindName("HandPanel"));
                var handList = Assert.IsType<ListBox>(view.FindName("HandList"));
                var choicesList = Assert.IsType<ListBox>(view.FindName("ChoicesList"));

                handPanel.Visibility = Visibility.Collapsed;
                handList.ItemsSource = new ObservableCollection<HandCardItem>();
                choicesList.Visibility = Visibility.Visible;
                choicesList.ItemsSource = new ObservableCollection<ChoiceItem>
                {
                    new("Jouer carte"),
                    new("Piocher"),
                };

                view.UpdateLayout();
                view.FocusPreferredInteractiveElement();

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(choicesList), dispatcher, 2200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void FocusPreferredInteractiveElement_NonForced_KeepsCurrentInGameFocus()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var window = CreateHostWindow(view);

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var handPanel = Assert.IsType<StackPanel>(view.FindName("HandPanel"));
                var handList = Assert.IsType<ListBox>(view.FindName("HandList"));
                var choicesList = Assert.IsType<ListBox>(view.FindName("ChoicesList"));

                handPanel.Visibility = Visibility.Visible;
                handList.Visibility = Visibility.Visible;
                choicesList.Visibility = Visibility.Visible;

                handList.ItemsSource = new ObservableCollection<HandCardItem>
                {
                    new("Rouge 1"),
                    new("Jaune 6"),
                };
                choicesList.ItemsSource = new ObservableCollection<ChoiceItem>
                {
                    new("Jouer carte"),
                    new("Piocher"),
                };

                view.UpdateLayout();
                choicesList.SelectedIndex = 0;
                choicesList.Focus();
                Keyboard.Focus(choicesList);
                Assert.True(IsFocusWithin(choicesList));

                view.FocusPreferredInteractiveElement(forceFromOutsideTextInput: false);

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(choicesList), dispatcher, 1200));
                Assert.False(IsFocusWithin(handList));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void FocusPreferredInteractiveElement_NonForced_RecoversWhenFocusIsLost()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var window = CreateHostWindow(view);

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                Keyboard.ClearFocus();
                Assert.Null(Keyboard.FocusedElement);

                view.FocusPreferredInteractiveElement(forceFromOutsideTextInput: false);

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(view), dispatcher, 2200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void FocusPreferredInteractiveElement_WhenNoInteractiveTarget_FocusesGameRoot()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var window = CreateHostWindow(view);

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var handPanel = Assert.IsType<StackPanel>(view.FindName("HandPanel"));
                var handList = Assert.IsType<ListBox>(view.FindName("HandList"));
                var choicesList = Assert.IsType<ListBox>(view.FindName("ChoicesList"));

                handPanel.Visibility = Visibility.Collapsed;
                handList.ItemsSource = new ObservableCollection<HandCardItem>();
                choicesList.ItemsSource = new ObservableCollection<ChoiceItem>();
                choicesList.Visibility = Visibility.Collapsed;

                view.UpdateLayout();
                view.FocusPreferredInteractiveElement();

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(view), dispatcher, 2200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void FocusPreferredInteractiveElement_Forced_PreservesExternalTextInputUnlessExplicitlyAllowed()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var outside = new RichTextBox { Width = 320, Height = 120 };
            var layout = new Grid();
            layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            Grid.SetRow(outside, 0);
            Grid.SetRow(view, 1);
            layout.Children.Add(outside);
            layout.Children.Add(view);

            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = layout,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var handPanel = Assert.IsType<StackPanel>(view.FindName("HandPanel"));
                var handList = Assert.IsType<ListBox>(view.FindName("HandList"));
                handPanel.Visibility = Visibility.Visible;
                handList.Visibility = Visibility.Visible;
                handList.ItemsSource = new ObservableCollection<HandCardItem>
                {
                    new("Bleu 2"),
                    new("Vert 4"),
                };

                outside.Focus();
                Keyboard.Focus(outside);
                Assert.True(IsFocusWithin(outside));

                view.FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(outside), dispatcher, 1200));

                view.FocusPreferredInteractiveElement(
                    forceFromOutsideTextInput: true,
                    allowExternalTextInputSteal: true);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(handList), dispatcher, 2200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void GridSurface_CellsAreNotTabStops_AndGridLabelsAreSilent()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var window = CreateHostWindow(view);

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var gridBoard = Assert.IsType<Border>(view.FindName("GridBoard"));
                var gridItems = Assert.IsType<GridCellsControl>(view.FindName("GridItems"));

                gridBoard.Visibility = Visibility.Visible;
                gridItems.Visibility = Visibility.Visible;
                gridItems.DataContext = new FakeGridVm(3, new ObservableCollection<GridCellViewModel>
                {
                    new(0, 0, 0),
                    new(1, 0, 1),
                    new(2, 0, 2),
                });

                view.UpdateLayout();
                StaDispatcherHarness.Drain(dispatcher);

                Assert.Equal("Grille", AutomationProperties.GetName(gridBoard));
                Assert.Equal("Grille", AutomationProperties.GetName(gridItems));

                var firstCell = gridItems.ItemContainerGenerator.ContainerFromIndex(0) as A11yGridCell;
                Assert.NotNull(firstCell);
                Assert.False(firstCell!.IsTabStop);
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void TabLikeNavigation_DoesNotLandOnGridCell()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();
            var view = new GamePlayView();
            var outside = new TextBox { Width = 320, Height = 30, Text = "outside" };
            var layout = new Grid();
            layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            Grid.SetRow(outside, 0);
            Grid.SetRow(view, 1);
            layout.Children.Add(outside);
            layout.Children.Add(view);

            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = layout,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var gridBoard = Assert.IsType<Border>(view.FindName("GridBoard"));
                var gridItems = Assert.IsType<GridCellsControl>(view.FindName("GridItems"));
                gridBoard.Visibility = Visibility.Visible;
                gridItems.Visibility = Visibility.Visible;
                gridItems.DataContext = new FakeGridVm(3, new ObservableCollection<GridCellViewModel>
                {
                    new(0, 0, 0),
                    new(1, 0, 1),
                    new(2, 0, 2),
                });

                view.UpdateLayout();
                StaDispatcherHarness.Drain(dispatcher);

                outside.Focus();
                Keyboard.Focus(outside);
                Assert.True(IsFocusWithin(outside));

                outside.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
                StaDispatcherHarness.Drain(dispatcher);

                var focused = Keyboard.FocusedElement as DependencyObject;
                Assert.NotNull(focused);
                Assert.False(IsOrHasAncestor<A11yGridCell>(focused!));
            }
            finally
            {
                window.Close();
            }
        });
    }

    private static Window CreateHostWindow(GamePlayView view)
    {
        return new Window
        {
            Width = 1000,
            Height = 700,
            Content = view,
            ShowInTaskbar = false,
            WindowStyle = WindowStyle.None,
        };
    }

    private static void EnsureTestApplicationResources()
    {
        if (Application.Current == null)
        {
            _ = new Application
            {
                ShutdownMode = ShutdownMode.OnExplicitShutdown
            };
        }

        var resources = Application.Current!.Resources;
        if (!resources.Contains("HighlightBrush"))
        {
            resources["HighlightBrush"] = new SolidColorBrush(Color.FromRgb(0xF2, 0xC1, 0x4E));
        }
    }

    private static bool IsFocusWithin(DependencyObject root)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, root))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private static DependencyObject? GetVisualOrLogicalParent(DependencyObject current)
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
            // fallback below
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }

    private static bool IsOrHasAncestor<T>(DependencyObject current) where T : DependencyObject
    {
        for (var node = current; node != null; node = GetVisualOrLogicalParent(node))
        {
            if (node is T)
            {
                return true;
            }
        }

        return false;
    }

    private sealed class FakeGridVm
    {
        public FakeGridVm(int size, ObservableCollection<GridCellViewModel> cells)
        {
            Size = size;
            Cells = cells;
        }

        public int Size { get; }
        public ObservableCollection<GridCellViewModel> Cells { get; }
        public string Status => string.Empty;
    }

    private sealed record HandCardItem(string Label);
    private sealed record ChoiceItem(string Text);

    private static class StaDispatcherHarness
    {
        public static void Run(Action<Dispatcher> action)
        {
            Exception? failure = null;
            var done = new ManualResetEventSlim(false);

            var thread = new Thread(() =>
            {
                try
                {
                    action(Dispatcher.CurrentDispatcher);
                }
                catch (Exception ex)
                {
                    failure = ex;
                }
                finally
                {
                    done.Set();
                }
            });
            thread.IsBackground = true;
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();

            Assert.True(done.Wait(7000), "STA dispatcher test timed out.");
            if (failure != null)
            {
                throw failure;
            }
        }

        public static bool WaitUntil(Func<bool> predicate, Dispatcher dispatcher, int timeoutMs)
        {
            var sw = Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                if (predicate())
                {
                    return true;
                }

                PumpOnce(dispatcher);
                Thread.Sleep(20);
            }

            return predicate();
        }

        public static void Drain(Dispatcher dispatcher, int maxPasses = 20)
        {
            for (var i = 0; i < maxPasses; i++)
            {
                PumpOnce(dispatcher);
            }
        }

        private static void PumpOnce(Dispatcher dispatcher)
        {
            var frame = new DispatcherFrame();
            dispatcher.BeginInvoke(
                DispatcherPriority.ApplicationIdle,
                new Action(() => frame.Continue = false));
            Dispatcher.PushFrame(frame);
        }
    }
}
