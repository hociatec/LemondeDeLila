using System;
using System.Text.Json;
using client_win.Modules.Game.Play.Session.Dtos;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Network.Services;
using Serilog;

namespace client_win.Modules.Game.Play.Session.Services;

internal sealed class GameSessionMessageRouter
{
    private readonly JsonSerializerOptions _json;
    private readonly Action<GameStateDto> _emitState;
    private readonly Action<TurnInfoDto> _emitTurn;
    private readonly Action<GameRulesPayloadDto> _emitRules;
    private readonly Action<string> _emitError;
    private readonly Action<string> _emitCommandAck;
    private readonly Action<string> _emitUiMessage;
    private readonly Action<GameKeyAckDto>? _emitKeyAck;
    private readonly Action<string> _emitStatePatch;
    private readonly Action<GameEndedDto> _emitEnded;
    private readonly Action<string> _emitRaw;
    private readonly Action? _emitPong;

    internal GameSessionMessageRouter(
        JsonSerializerOptions json,
        Action<GameStateDto> emitState,
        Action<TurnInfoDto> emitTurn,
        Action<GameRulesPayloadDto> emitRules,
        Action<string> emitError,
        Action<string> emitCommandAck,
        Action<string> emitUiMessage,
        Action<GameKeyAckDto>? emitKeyAck,
        Action<string> emitStatePatch,
        Action<GameEndedDto> emitEnded,
        Action<string> emitRaw,
        Action? emitPong = null)
    {
        _json = json ?? throw new ArgumentNullException(nameof(json));
        _emitState = emitState ?? throw new ArgumentNullException(nameof(emitState));
        _emitTurn = emitTurn ?? throw new ArgumentNullException(nameof(emitTurn));
        _emitRules = emitRules ?? throw new ArgumentNullException(nameof(emitRules));
        _emitError = emitError ?? throw new ArgumentNullException(nameof(emitError));
        _emitCommandAck = emitCommandAck ?? throw new ArgumentNullException(nameof(emitCommandAck));
        _emitUiMessage = emitUiMessage ?? throw new ArgumentNullException(nameof(emitUiMessage));
        _emitKeyAck = emitKeyAck;
        _emitStatePatch = emitStatePatch ?? throw new ArgumentNullException(nameof(emitStatePatch));
        _emitEnded = emitEnded ?? throw new ArgumentNullException(nameof(emitEnded));
        _emitRaw = emitRaw ?? throw new ArgumentNullException(nameof(emitRaw));
        _emitPong = emitPong;
    }

    internal void HandleRawMessage(string raw)
    {
        _emitRaw(raw);

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp) ||
                typeProp.ValueKind != JsonValueKind.String)
            {
                return;
            }

            var type = typeProp.GetString() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(type))
            {
                return;
            }

            if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
            {
                HandleError(root);
                return;
            }

            if (string.Equals(type, "game.pong", StringComparison.OrdinalIgnoreCase))
            {
                HandlePong(root);
                return;
            }

            if (string.Equals(type, "game.ack", StringComparison.OrdinalIgnoreCase))
            {
                HandleCommandAck(root);
                return;
            }

            if (string.Equals(type, "game.state", StringComparison.OrdinalIgnoreCase))
            {
                HandleState(root);
                return;
            }

            if (string.Equals(type, "game.patch", StringComparison.OrdinalIgnoreCase))
            {
                HandleStatePatch(root);
                return;
            }

            if (string.Equals(type, "game.ended", StringComparison.OrdinalIgnoreCase))
            {
                HandleEnded(root);
                return;
            }

            if (string.Equals(type, "game.turn", StringComparison.OrdinalIgnoreCase))
            {
                HandleTurn(root);
                return;
            }

            if (string.Equals(type, "game.rules", StringComparison.OrdinalIgnoreCase))
            {
                HandleRules(root);
            }
        }
        catch
        {
            // ignore
        }
    }

    private void HandleCommandAck(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var action = payload.TryGetProperty("action", out var actionProp) &&
                         actionProp.ValueKind == JsonValueKind.String
                ? actionProp.GetString() ?? string.Empty
                : string.Empty;

            if (string.Equals(action, "game.actions", StringComparison.OrdinalIgnoreCase))
            {
                _emitCommandAck("Action reçue par le serveur.");
                return;
            }

            if (string.Equals(action, "game.key", StringComparison.OrdinalIgnoreCase))
            {
                var ok = payload.TryGetProperty("ok", out var okProp) && okProp.ValueKind == JsonValueKind.True;

                var key = payload.TryGetProperty("key", out var keyProp) && keyProp.ValueKind == JsonValueKind.String
                    ? (keyProp.GetString() ?? string.Empty).Trim().ToUpperInvariant()
                    : string.Empty;

                var message = payload.TryGetProperty("message", out var messageProp) &&
                              messageProp.ValueKind == JsonValueKind.String
                    ? (messageProp.GetString() ?? string.Empty).Trim()
                    : string.Empty;

                var panelId = payload.TryGetProperty("panelId", out var panelProp) &&
                              panelProp.ValueKind == JsonValueKind.String
                    ? (panelProp.GetString() ?? string.Empty).Trim()
                    : string.Empty;

                var roomOp = payload.TryGetProperty("roomOp", out var roomProp) &&
                             roomProp.ValueKind == JsonValueKind.String
                    ? (roomProp.GetString() ?? string.Empty).Trim()
                    : string.Empty;

                if (!string.IsNullOrWhiteSpace(key))
                {
                    _emitKeyAck?.Invoke(new GameKeyAckDto
                    {
                        Key = key,
                        Ok = ok,
                        PanelId = string.IsNullOrWhiteSpace(panelId) ? null : panelId,
                        Message = string.IsNullOrWhiteSpace(message) ? null : message,
                        RoomOp = string.IsNullOrWhiteSpace(roomOp) ? null : roomOp,
                    });
                }

                if (!string.IsNullOrWhiteSpace(message))
                {
                    // Robustesse lecteur d'écran: si l'utilisateur spamme 'T' pour ré-entendre "à qui le tour",
                    // certains lecteurs/dédup peuvent ignorer les messages identiques. On rend le message unique
                    // sans impact visuel/audible en alternant un caractère invisible.
                    _emitUiMessage($"[ui.shortcut] {message}");
                    return;
                }

                if (!ok)
                {
                    var reason = payload.TryGetProperty("reason", out var reasonProp) &&
                                 reasonProp.ValueKind == JsonValueKind.String
                        ? (reasonProp.GetString() ?? string.Empty).Trim()
                        : string.Empty;
                    var baseMessage = string.IsNullOrWhiteSpace(reason)
                        ? "Raccourci indisponible."
                        : $"Raccourci indisponible : {reason}";
                    _emitUiMessage($"[ui.shortcut] {baseMessage}");
                }
            }
        }
        catch
        {
            // ignore
        }
    }
    private void HandlePong(JsonElement root)
    {
        var receivedAtMs = ServerClock.UtcNowMs();
        _emitPong?.Invoke();

        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("serverTimeMs", out var serverTimeProp) ||
                serverTimeProp.ValueKind != JsonValueKind.Number)
            {
                return;
            }

            if (!payload.TryGetProperty("clientSentAtMs", out var clientSentProp) ||
                clientSentProp.ValueKind != JsonValueKind.Number)
            {
                return;
            }

            var serverTimeMs = serverTimeProp.GetInt64();
            var clientSentAtMs = clientSentProp.GetInt64();
            ServerClock.UpdateFromPong(serverTimeMs, clientSentAtMs, receivedAtMs);
        }
        catch
        {
            // ignore
        }
    }

    private void HandleError(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("message", out var messageProp))
            {
                return;
            }

            var message = messageProp.GetString();
            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            _emitError(message.Trim());
        }
        catch
        {
            // ignore
        }
    }

    private void HandleRules(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var gameType = payload.TryGetProperty("gameType", out var gameTypeProp) &&
                           gameTypeProp.ValueKind == JsonValueKind.String
                ? (gameTypeProp.GetString() ?? string.Empty).Trim()
                : string.Empty;

            var rules = payload.TryGetProperty("rules", out var rulesProp) &&
                        rulesProp.ValueKind == JsonValueKind.String
                ? rulesProp.GetString() ?? string.Empty
                : string.Empty;

            if (string.IsNullOrWhiteSpace(gameType))
            {
                return;
            }

            _emitRules(new GameRulesPayloadDto(gameType, rules));
        }
        catch
        {
            // ignore
        }
    }

    private void HandleState(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<GameStateDto>(_json);
            if (payload == null) return;

            _emitState(payload);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "GameSession: ignore message parse error");
        }
    }

    private void HandleStatePatch(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            _emitStatePatch(payloadProp.GetRawText());
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "GameSession: ignore state patch parse error");
        }
    }

    private void HandleTurn(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<TurnInfoDto>(_json);
            if (payload == null) return;

            _emitTurn(payload);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "GameSession: ignore turn parse error");
        }
    }

    private void HandleEnded(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<GameEndedDto>(_json);
            if (payload == null)
            {
                return;
            }

            _emitEnded(payload);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "GameSession: ignore game.ended parse error");
        }
    }
}


