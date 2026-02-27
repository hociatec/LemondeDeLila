using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Shell.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GameRoomViewFocusFlowTests
{
    [Fact]
    public void EnterOnTable_OpensWizard_AndFocusesFirstAmbienceChoice()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var startCalls = 0;
            GameRoomViewModel? vmRef = null;

            var vm = CreateViewModel(
                focusCoordinator,
                onStart: () =>
                {
                    startCalls++;
                    _ = vmRef!.OpenStartWizardAsync(
                        currentAmbienceSoundId: string.Empty,
                        ambienceChoices: new[]
                        {
                            new GameRoomViewModel.StartWizardAmbienceChoice(string.Empty, "Silence (aucune ambiance)"),
                            new GameRoomViewModel.StartWizardAmbienceChoice("Rain", "Pluie"),
                        },
                        initialConfigPrompt: null,
                        loadConfigPromptAsync: null);
                    return Task.CompletedTask;
                });
            vmRef = vm;
            vm.GameZone.CanStart = true;

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

                SendPreviewEnter(view);

                Assert.True(StaDispatcherHarness.WaitUntil(() => vm.IsStartWizardOpen, dispatcher, 2000));
                Assert.Equal(1, startCalls);

                var choices = Assert.IsType<ListBox>(view.FindName("StartWizardChoicesList"));
                Assert.True(StaDispatcherHarness.WaitUntil(() => choices.SelectedIndex == 0, dispatcher, 2000));
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(choices), dispatcher, 2000));
            }
            finally
            {
                vm.CancelStartWizard();
                window.Close();
            }
        });
    }

    [Fact]
    public void EnterOnWizardNext_GoesToConfigStep_AndFocusesFirstConfigField()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusCoordinator = new GameFocusCoordinator(dispatcher);
            var startCalls = 0;
            GameRoomViewModel? vmRef = null;

            var vm = CreateViewModel(
                focusCoordinator,
                onStart: () =>
                {
                    startCalls++;
                    _ = vmRef!.OpenStartWizardAsync(
                        currentAmbienceSoundId: string.Empty,
                        ambienceChoices: new[]
                        {
                            new GameRoomViewModel.StartWizardAmbienceChoice(string.Empty, "Silence (aucune ambiance)"),
                            new GameRoomViewModel.StartWizardAmbienceChoice("Rain", "Pluie"),
                        },
                        initialConfigPrompt: new GameRoomViewModel.StartWizardConfigPrompt(
                            Title: "Configuration Lama",
                            ActionType: "lama_set_config",
                            CancelActionType: null,
                            Fields: new[]
                            {
                                new GameRoomViewModel.StartWizardConfigField(
                                    Key: "jetons_defaite",
                                    Label: "Jetons de defaite",
                                    Kind: "number",
                                    Min: 1,
                                    Max: 100,
                                    InitialText: "10"),
                            }),
                        loadConfigPromptAsync: null);
                    return Task.CompletedTask;
                });
            vmRef = vm;
            vm.GameZone.CanStart = true;

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

                SendPreviewEnter(view);
                Assert.True(StaDispatcherHarness.WaitUntil(() => vm.IsStartWizardOpen, dispatcher, 2000));
                Assert.Equal(1, startCalls);

                var next = Assert.IsType<Button>(view.FindName("StartWizardNextButton"));
                Assert.True(StaDispatcherHarness.WaitUntil(() => next.Visibility == Visibility.Visible && next.IsEnabled, dispatcher, 2000));
                next.Focus();
                Keyboard.Focus(next);

                SendPreviewEnter(view);

                Assert.True(StaDispatcherHarness.WaitUntil(() => vm.IsStartWizardConfigStep, dispatcher, 2000));
                var configItems = Assert.IsType<ItemsControl>(view.FindName("StartWizardConfigItems"));
                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(configItems), dispatcher, 2000));
            }
            finally
            {
                vm.CancelStartWizard();
                window.Close();
            }
        });
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
