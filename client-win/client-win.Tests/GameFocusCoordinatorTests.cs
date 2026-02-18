using System.Diagnostics;
using System.Threading;
using System.Windows.Threading;
using client_win.Modules.Game.Shell.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GameFocusCoordinatorTests
{
    [Fact]
    public void DefaultReason_StopsAfterAnchor()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var coordinator = new GameFocusCoordinator(dispatcher);
            var host = new FakeHost(GameFocusAttemptResult.Anchor);
            using var _ = coordinator.AttachHost(host);

            coordinator.RequestGameZone(GameFocusReason.Default);

            Assert.True(StaDispatcherHarness.WaitUntil(() => host.CallCount >= 1, dispatcher, 1000));
            StaDispatcherHarness.Drain(dispatcher);

            Assert.Equal(1, host.CallCount);
            Assert.InRange(host.ActivateCount, 0, 1);
        });
    }

    [Fact]
    public void ChoosePawn_RequiresInteractive()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var coordinator = new GameFocusCoordinator(dispatcher);
            var host = new FakeHost(GameFocusAttemptResult.Anchor, GameFocusAttemptResult.Interactive);
            using var _ = coordinator.AttachHost(host);

            coordinator.RequestGameZone(GameFocusReason.ChoosePawn);

            Assert.True(StaDispatcherHarness.WaitUntil(() => host.CallCount >= 2, dispatcher, 1000));
            StaDispatcherHarness.Drain(dispatcher);

            Assert.Equal(2, host.CallCount);
            Assert.Equal(1, host.ActivateCount);
            Assert.Equal(GameFocusReason.ChoosePawn, host.LastReason);
        });
    }

    [Fact]
    public void NewRequest_CancelsPreviousPendingPasses()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var coordinator = new GameFocusCoordinator(dispatcher);
            var host = new FakeHost(GameFocusAttemptResult.Anchor);
            using var _ = coordinator.AttachHost(host);

            coordinator.RequestGameZone(GameFocusReason.AfterDialog);
            coordinator.RequestGameZone(GameFocusReason.AfterDialog);

            Assert.True(StaDispatcherHarness.WaitUntil(() => host.CallCount >= 1, dispatcher, 1000));
            StaDispatcherHarness.Drain(dispatcher);

            Assert.Equal(1, host.CallCount);
            Assert.InRange(host.ActivateCount, 0, 1);
        });
    }

    private sealed class FakeHost : IGameFocusHost
    {
        private readonly Queue<GameFocusAttemptResult> _results;

        public FakeHost(params GameFocusAttemptResult[] results)
        {
            _results = new Queue<GameFocusAttemptResult>(results.Length == 0
                ? new[] { GameFocusAttemptResult.Interactive }
                : results);
        }

        public int ActivateCount { get; private set; }
        public int CallCount { get; private set; }
        public GameFocusReason LastReason { get; private set; }

        public void ActivateWindow() => ActivateCount++;

        public GameFocusAttemptResult FocusGameZone(GameFocusReason reason)
        {
            CallCount++;
            LastReason = reason;
            if (_results.Count == 0)
            {
                return GameFocusAttemptResult.Interactive;
            }

            return _results.Dequeue();
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

            Assert.True(done.Wait(5000), "STA dispatcher test timed out.");
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
