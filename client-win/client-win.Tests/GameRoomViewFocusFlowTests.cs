using System.ComponentModel;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Views;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Shell.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GameRoomViewFocusFlowTests
{
    [Fact]
    public void EnterOnTable_NotStarted_TriggersStartCommand()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var startCalls = 0;

            var vm = CreateViewModel(
                focusCoordinator,
                onStart: () =>
                {
                    startCalls++;
                    return Task.CompletedTask;
                });
            vm.GameZone.CanStart = true;
            vm.GameZone.IsStarted = false;

            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);
                var zone = Assert.IsType<GameZoneHostView>(view.FindName("GameZoneHost"));

                SendEnterOnZoneAnchor(zone, "GameZoneFocusAnchor");
                Assert.Equal(1, startCalls);
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void EnterOnTable_Started_DoesNotTriggerStartAgain()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var startCalls = 0;

            var vm = CreateViewModel(
                focusCoordinator,
                onStart: () =>
                {
                    startCalls++;
                    return Task.CompletedTask;
                });
            vm.GameZone.CanStart = true;
            vm.GameZone.IsStarted = true;

            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);
                var zone = Assert.IsType<GameZoneHostView>(view.FindName("GameZoneHost"));

                SendEnterOnZoneAnchor(zone, "GameZoneFocusAnchor");
                Assert.Equal(0, startCalls);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void Enter_WhenTableNotStarted_StartsEvenIfFocusNotOnHeaderOrAnchor()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var startCalls = 0;

            var vm = CreateViewModel(
                focusCoordinator,
                onStart: () =>
                {
                    startCalls++;
                    return Task.CompletedTask;
                });
            vm.GameZone.CanStart = true;
            vm.GameZone.IsStarted = false;

            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                historyTarget.Focus();
                Keyboard.Focus(historyTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                SendPreviewEnter(view);
                Assert.Equal(1, startCalls);
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void TableStartedFocusRequest_DoesNotStealFocusFromHistory()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                historyTarget.Focus();
                Keyboard.Focus(historyTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                vm.GameZone.RequestFocus(GameFocusReason.TableStarted);

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void ArrowDown_FromGameName_DoesNotEscapeTableView()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var header = Assert.IsType<GameRoomHeaderView>(view.FindName("HeaderHost"));
                var nameTarget = header.NameFocusTarget;
                Assert.NotNull(nameTarget);

                nameTarget!.Focus();
                Keyboard.Focus(nameTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(nameTarget), dispatcher, 1200));

                nameTarget.MoveFocus(new TraversalRequest(FocusNavigationDirection.Down));
                StaDispatcherHarness.Drain(dispatcher);

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(view), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void ShiftTabThenArrowDown_DoesNotEscapeTableView()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                historyTarget.Focus();
                Keyboard.Focus(historyTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                InvokeTabCycle(view, isShift: true);
                StaDispatcherHarness.Drain(dispatcher);

                var focused = Keyboard.FocusedElement as DependencyObject;
                Assert.NotNull(focused);
                Assert.True(IsFocusWithin(view));

                if (focused is UIElement ui)
                {
                    ui.MoveFocus(new TraversalRequest(FocusNavigationDirection.Down));
                }
                StaDispatcherHarness.Drain(dispatcher);

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(view), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void Tab_FromHistory_CyclesToGameZone()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                historyTarget.Focus();
                Keyboard.Focus(historyTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                InvokeTabCycle(view, isShift: false);
                StaDispatcherHarness.Drain(dispatcher);

                var zone = Assert.IsType<GameZoneHostView>(view.FindName("GameZoneHost"));
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void ShiftTab_FromGameZone_CyclesToHistory()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var zone = Assert.IsType<GameZoneHostView>(view.FindName("GameZoneHost"));
                var anchor = zone.FindName("GameZoneFocusAnchor") as UIElement;
                Assert.NotNull(anchor);
                anchor!.Focus();
                Keyboard.Focus(anchor);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));

                InvokeTabCycle(view, isShift: true);
                StaDispatcherHarness.Drain(dispatcher);

                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void Tab_CyclesGameZoneToChatToHistoryToGameZone()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var zone = Assert.IsType<GameZoneHostView>(view.FindName("GameZoneHost"));
                var anchor = zone.FindName("GameZoneFocusAnchor") as UIElement;
                Assert.NotNull(anchor);
                anchor!.Focus();
                Keyboard.Focus(anchor);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));

                InvokeTabCycle(view, isShift: false);
                StaDispatcherHarness.Drain(dispatcher);
                var chat = Assert.IsType<TextBox>(view.FindName("ChatInput"));
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(chat), dispatcher, 1200));

                InvokeTabCycle(view, isShift: false);
                StaDispatcherHarness.Drain(dispatcher);
                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                InvokeTabCycle(view, isShift: false);
                StaDispatcherHarness.Drain(dispatcher);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void ShiftTab_CyclesGameZoneToHistoryToChatToGameZone()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var zone = Assert.IsType<GameZoneHostView>(view.FindName("GameZoneHost"));
                var anchor = zone.FindName("GameZoneFocusAnchor") as UIElement;
                Assert.NotNull(anchor);
                anchor!.Focus();
                Keyboard.Focus(anchor);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));

                InvokeTabCycle(view, isShift: true);
                StaDispatcherHarness.Drain(dispatcher);
                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                InvokeTabCycle(view, isShift: true);
                StaDispatcherHarness.Drain(dispatcher);
                var chat = Assert.IsType<TextBox>(view.FindName("ChatInput"));
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(chat), dispatcher, 1200));

                InvokeTabCycle(view, isShift: true);
                StaDispatcherHarness.Drain(dispatcher);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void RapidTabCycle_RemainsStable_WhenFocusIsTemporarilyLost()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var zone = Assert.IsType<GameZoneHostView>(view.FindName("GameZoneHost"));
                var anchor = zone.FindName("GameZoneFocusAnchor") as UIElement;
                Assert.NotNull(anchor);
                anchor!.Focus();
                Keyboard.Focus(anchor);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(zone), dispatcher, 1200));

                InvokeTabCycle(view, isShift: false);
                StaDispatcherHarness.Drain(dispatcher);
                var chat = Assert.IsType<TextBox>(view.FindName("ChatInput"));
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(chat), dispatcher, 1200));

                Keyboard.ClearFocus();
                Assert.Null(Keyboard.FocusedElement);

                InvokeTabCycle(view, isShift: false);
                StaDispatcherHarness.Drain(dispatcher);

                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void RapidTabCycle_DoesNotGetStolenByPendingGameplayFocusRecovery()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();

            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var vm = CreateViewModel(focusCoordinator, onStart: () => Task.CompletedTask);
            vm.GameZone.IsStarted = true;

            var gameplay = new GamePlayView();
            var handPanel = Assert.IsType<StackPanel>(gameplay.FindName("HandPanel"));
            var handList = Assert.IsType<ListBox>(gameplay.FindName("HandList"));
            handPanel.Visibility = Visibility.Visible;
            handList.Visibility = Visibility.Visible;
            handList.ItemsSource = new ObservableCollection<object>
            {
                "Carte 1",
                "Carte 2",
            };
            vm.GameZone.Content = gameplay;

            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                gameplay.FocusPreferredInteractiveElement(forceFromOutsideTextInput: true, allowExternalTextInputSteal: true);
                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                Assert.True(InvokePrivateBool(view, "TryFocusHistoryInternal"));
                StaDispatcherHarness.Drain(dispatcher);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                Thread.Sleep(700);
                StaDispatcherHarness.Drain(dispatcher);

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void EnterOutsideGameZone_DoesNotStartWhenInlinePromptIsVisible()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();

            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var startCalls = 0;
            var vm = CreateViewModel(
                focusCoordinator,
                onStart: () =>
                {
                    startCalls++;
                    return Task.CompletedTask;
                });
            vm.GameZone.CanStart = true;
            vm.GameZone.IsStarted = false;

            var gameplay = new GamePlayView();
            vm.GameZone.Content = gameplay;

            var view = new GameRoomView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = view,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var overlay = Assert.IsType<Border>(gameplay.FindName("InlinePromptOverlay"));
                overlay.Visibility = Visibility.Visible;
                gameplay.UpdateLayout();

                var history = Assert.IsType<GameHistoryView>(view.FindName("HistoryHost"));
                var historyTarget = Assert.IsAssignableFrom<FrameworkElement>(history.FocusTarget);
                historyTarget.Focus();
                Keyboard.Focus(historyTarget);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(historyTarget), dispatcher, 1200));

                SendPreviewEnter(view);

                Assert.Equal(0, startCalls);
            }
            finally
            {
                window.Close();
            }
        });
    }

    private static void EnsureTestApplicationResources()
    {
        if (Application.Current == null)
        {
            _ = new Application();
        }
    }

    private static GameRoomViewModel CreateViewModel(IGameFocusCoordinator focusCoordinator, Func<Task> onStart)
    {
        var game = new CatalogGame
        {
            Id = "lama",
            Name = "Lama",
            Summary = "Test",
            MinPlayers = 2,
            MaxPlayers = 6,
            Engine = "plateau",
            ChatEnabled = true,
            ChatSoundsEnabled = true,
        };

        static Task Done() => Task.CompletedTask;

        return new GameRoomViewModel(
            game,
            onSendChat: _ => Task.CompletedTask,
            onShowRules: Done,
            onConfigureTableAmbience: Done,
            onConfigureTableAmbienceVolume: Done,
            onStart: onStart,
            onSaveSnapshot: Done,
            onReset: Done,
            onQuit: Done,
            onAddBot: Done,
            onRemoveBot: Done,
            onAnnouncePlayers: Done,
            onAnnounceInfo: Done,
            onTogglePrivacy: Done,
            onToggleRole: Done,
            onInvite: Done,
            onKick: Done,
            onBan: Done,
            onTransferOwner: Done,
            dialogs: new NoopDialogService(),
            focusCoordinator: focusCoordinator,
            screenReader: new NoopScreenReaderAnnouncer(),
            announcements: new NoopAnnouncementService());
    }

    private static void SendPreviewEnter(GameRoomView view)
    {
        var source = PresentationSource.FromVisual(view);
        Assert.NotNull(source);

        var args = new KeyEventArgs(Keyboard.PrimaryDevice, source!, Environment.TickCount, Key.Enter)
        {
            RoutedEvent = Keyboard.PreviewKeyDownEvent
        };

        var method = typeof(GameRoomView)
            .GetMethods(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            .FirstOrDefault(m =>
                string.Equals(m.Name, "OnPreviewKeyDown", StringComparison.Ordinal) &&
                m.GetParameters().Length == 2 &&
                m.GetParameters()[0].ParameterType == typeof(object) &&
                m.GetParameters()[1].ParameterType == typeof(KeyEventArgs));
        Assert.NotNull(method);
        method!.Invoke(view, new object[] { view, args });
    }

    private static void SendEnterOnZoneAnchor(GameZoneHostView zone, string anchorName)
    {
        var anchor = zone.FindName(anchorName) as UIElement;
        Assert.NotNull(anchor);
        anchor!.Focus();
        Keyboard.Focus(anchor);

        var source = PresentationSource.FromVisual(zone);
        Assert.NotNull(source);
        var args = new KeyEventArgs(Keyboard.PrimaryDevice, source!, Environment.TickCount, Key.Enter)
        {
            RoutedEvent = Keyboard.PreviewKeyDownEvent
        };

        var method = typeof(GameZoneHostView)
            .GetMethod(
                "OnAnchorPreviewKeyDown",
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
        Assert.NotNull(method);
        method!.Invoke(zone, new object[] { anchor, args });
    }

    private static void InvokeTabCycle(GameRoomView view, bool isShift)
    {
        var method = typeof(GameRoomView)
            .GetMethods(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            .FirstOrDefault(m =>
                string.Equals(m.Name, "TryHandleTabCycle", StringComparison.Ordinal) &&
                m.GetParameters().Length == 1 &&
                m.GetParameters()[0].ParameterType == typeof(bool));
        Assert.NotNull(method);
        var result = method!.Invoke(view, new object[] { isShift });
        Assert.True(result is bool b && b);
    }

    private static bool InvokePrivateBool(object instance, string methodName)
    {
        var method = instance.GetType().GetMethod(
            methodName,
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var result = method!.Invoke(instance, Array.Empty<object>());
        Assert.IsType<bool>(result);
        return (bool)result!;
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

    private static T? FindDescendant<T>(DependencyObject root, Func<T, bool>? predicate = null) where T : DependencyObject
    {
        var queue = new Queue<DependencyObject>();
        queue.Enqueue(root);
        while (queue.Count > 0)
        {
            var node = queue.Dequeue();
            if (node is T typed && (predicate?.Invoke(typed) ?? true))
            {
                return typed;
            }

            int count = 0;
            try
            {
                count = VisualTreeHelper.GetChildrenCount(node);
            }
            catch
            {
                // ignore
            }

            for (int i = 0; i < count; i++)
            {
                DependencyObject? child = null;
                try
                {
                    child = VisualTreeHelper.GetChild(node, i);
                }
                catch
                {
                    // ignore
                }

                if (child != null)
                {
                    queue.Enqueue(child);
                }
            }
        }

        return null;
    }

    private sealed class NoopDialogService : IDialogService
    {
        public Task ShowError(string title, string message) => Task.CompletedTask;
        public Task ShowInfo(string title, string message) => Task.CompletedTask;
        public Task<bool?> Confirm(string title, string message, string? okText = null, string? cancelText = null) =>
            Task.FromResult<bool?>(true);
        public Task<DialogChoice?> Choose(string title, string message, string primaryText, string secondaryText, string cancelText) =>
            Task.FromResult<DialogChoice?>(null);
        public Task<string?> Pick(string title, string message, IReadOnlyList<string> options, string? okText = null, string? cancelText = null) =>
            Task.FromResult<string?>(null);
    }

    private sealed class NoopScreenReaderAnnouncer : IScreenReaderAnnouncer
    {
        public bool IsRunning => false;
        public void AnnouncePolite(string message) { }
        public void AnnounceAssertive(string message) { }
        public void AnnounceAssertiveEvenIfInactive(string message) { }
        public void CancelSpeech() { }
    }

    private sealed class NoopAnnouncementService : IAnnouncementService
    {
        public bool IsAvailable => false;
        public void Enqueue(string message, AnnouncementPriority priority = AnnouncementPriority.Polite) { }
        public void EnqueueMany(IEnumerable<string> messages, AnnouncementPriority priority = AnnouncementPriority.Polite) { }
        public void CancelPending(bool cancelSpeech = false) { }
        public void NotifyUserInteraction() { }
        public void SetGameplayUltraReactive(bool enabled) { }
    }

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
