using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Shell.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GameZoneHostViewFocusTests
{
    [Fact]
    public void FocusGameZone_WithGameContent_FocusesInteractiveElement()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            EnsureTestApplicationResources();

            var gameplay = new GamePlayView();
            var handPanel = Assert.IsType<StackPanel>(gameplay.FindName("HandPanel"));
            var handList = Assert.IsType<ListBox>(gameplay.FindName("HandList"));
            handPanel.Visibility = Visibility.Visible;
            handList.Visibility = Visibility.Visible;
            handList.ItemsSource = new ObservableCollection<HandCardItem>
            {
                new("Carte 1"),
                new("Carte 2"),
            };

            var vm = CreateZoneVm();
            vm.IsStarted = true;
            vm.Content = gameplay;

            var host = new GameZoneHostView { DataContext = vm };
            var window = new Window
            {
                Width = 1000,
                Height = 700,
                Content = host,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var result = host.FocusGameZone(GameFocusReason.TableStarted);

                Assert.Equal(GameFocusAttemptResult.Interactive, result);
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(handList), dispatcher, 2200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void EnterOnEmptyAnchor_RaisesStartRequested()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var vm = CreateZoneVm();
            vm.IsStarted = false;
            vm.Content = null;

            var host = new GameZoneHostView { DataContext = vm };
            var window = new Window
            {
                Width = 700,
                Height = 450,
                Content = host,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
            };

            var startRequestedCount = 0;
            host.StartRequested += (_, _) => startRequestedCount++;

            try
            {
                window.Show();
                window.Activate();
                StaDispatcherHarness.Drain(dispatcher);

                var firstResult = host.FocusGameZone(GameFocusReason.Default);
                Assert.Equal(GameFocusAttemptResult.Anchor, firstResult);

                var emptyAnchor = Assert.IsType<GameZoneFocusAnchor>(host.FindName("GameZoneEmptyAnchor"));
                var source = PresentationSource.FromVisual(emptyAnchor);
                Assert.NotNull(source);

                var args = new KeyEventArgs(Keyboard.PrimaryDevice, source!, Environment.TickCount, Key.Enter)
                {
                    RoutedEvent = Keyboard.PreviewKeyDownEvent
                };
                emptyAnchor.RaiseEvent(args);

                Assert.True(StaDispatcherHarness.WaitUntil(() => startRequestedCount == 1, dispatcher, 1200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    private static GameZoneHostViewModel CreateZoneVm()
    {
        static Task Done() => Task.CompletedTask;

        return new GameZoneHostViewModel(
            title: "Zone test",
            onShowRules: Done,
            onConfigureTableAmbience: Done,
            onConfigureTableAmbienceVolume: Done,
            onStart: Done,
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
            focus: new NoopFocusCoordinator());
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

    private sealed record HandCardItem(string Label);

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

    private sealed class NoopFocusCoordinator : IGameFocusCoordinator
    {
        public IDisposable AttachHost(IGameFocusHost host) => new NoopDisposable();
        public void RequestGameZone(GameFocusReason reason = GameFocusReason.Default) { }
        public void CancelPendingRequests() { }

        private sealed class NoopDisposable : IDisposable
        {
            public void Dispose() { }
        }
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
