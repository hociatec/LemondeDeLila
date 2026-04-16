using System.Reflection;
using System.Text.Json;
using client_win.Modules.Game.Play.Actions.Services;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayActionDispatcherTests
{
    private sealed class RecordingSocket : IWebSocketConnection
    {
        public WebSocketState State => WebSocketState.Connected;
        public event Action<WebSocketState>? StateChanged
        {
            add { }
            remove { }
        }
        public event Action<string>? MessageReceived
        {
            add { }
            remove { }
        }
        public event Action<string>? Error
        {
            add { }
            remove { }
        }

        public Task ConnectAsync(Uri endpoint, string? token = null, IDictionary<string, string>? headers = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendAsync(string message, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task CloseAsync() => Task.CompletedTask;
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    [Fact]
    public void TryBuildPendingChoiceAction_PrefersServerChoiceActionsByIndex()
    {
        var session = new GameSession(roomId: 1, gameType: "any", socket: new RecordingSocket());
        var state = new GameStateDto
        {
            Status = "started",
            Phase = "play",
            TurnIndex = 1,
            Pending = new GamePendingDto
            {
                Type = "quiz",
                PlayerId = 1,
                Blocking = true,
                Choices = ["A", "B"],
                Data = JsonSerializer.SerializeToElement(new
                {
                    choiceActionsByIndex = new object[]
                    {
                        new { type = "answer_quiz", payload = new { answerIndex = 0 } },
                        new { type = "answer_quiz", payload = new { answerIndex = 1 } },
                    },
                }),
            },
            Actions =
            [
                // Intentionally irrelevant: the mapping is in pending.data.
                new GameAvailableActionDto { Type = "something_else" },
            ],
            Extras = JsonSerializer.SerializeToElement(new { viewerPlayerId = 1 }),
        };

        // Set private property `LastState` for the test.
        typeof(GameSession)
            .GetProperty(nameof(GameSession.LastState), BindingFlags.Instance | BindingFlags.Public)!
            .SetValue(session, state);

        var dispatcher = new GamePlayActionDispatcher();
        var ok = dispatcher.TryBuildPendingChoiceAction(
            session,
            selectedChoice: "B",
            selectedChoiceIndex: 1,
            out var action);

        Assert.True(ok);
        Assert.NotNull(action);
        Assert.Equal("answer_quiz", action!.Type);
        Assert.Equal("{\"answerIndex\":1}", JsonSerializer.Serialize(action.Payload));
    }
}

