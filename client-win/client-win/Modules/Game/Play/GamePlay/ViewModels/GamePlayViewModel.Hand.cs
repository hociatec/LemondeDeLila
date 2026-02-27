using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.GamePlay.Dtos;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel
{
    private readonly ObservableCollection<HandCardLine> _handCards = new();
    private int _selectedHandIndex = -1;
    private string _handStageLabel = string.Empty;
    private string _handWaitingLabel = string.Empty;

    public ObservableCollection<HandCardLine> HandCards => _handCards;

    public int SelectedHandIndex
    {
        get => _selectedHandIndex;
        set => SetProperty(ref _selectedHandIndex, value);
    }

    public bool HasHand => HandCards.Count > 0;

    public string HandStageLabel
    {
        get => _handStageLabel;
        private set => SetProperty(ref _handStageLabel, value ?? string.Empty);
    }

    public string HandWaitingLabel
    {
        get => _handWaitingLabel;
        private set => SetProperty(ref _handWaitingLabel, value ?? string.Empty);
    }

    partial void InitializeHandSupport()
    {
        HandCards.CollectionChanged += OnHandCollectionChanged;
    }

    private void OnHandCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        OnPropertyChanged(nameof(HasHand));
    }

    internal void SyncHandFromState(GameStateDto state)
    {
        var cards = GamePlayExtrasParser.ExtractHandCards(state);
        UpdateHandCards(cards);
        HandStageLabel = GamePlayExtrasParser.ExtractHandStage(state) ?? string.Empty;
        var waiting = GamePlayExtrasParser.ExtractWaitingPlayers(state);
        HandWaitingLabel = BuildWaitingLabel(waiting);
    }

    public async Task<bool> SubmitSelectedHandCardAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator)
        {
            return false;
        }

        var session = _session;
        if (session == null || !session.IsConnected)
        {
            return false;
        }

        var card = GetSelectedHandCard();
        if (card == null)
        {
            return false;
        }

        var state = session.LastState;
        if (state == null)
        {
            return false;
        }

        var actions = state.Actions ?? new List<GameAvailableActionDto>();
        var hasActionForCard = actions.Any(action =>
            string.Equals(action.Type, "select_card", StringComparison.OrdinalIgnoreCase) &&
            TryExtractCardId(action.Payload, out var payloadCardId) &&
            string.Equals(payloadCardId, card.CardId, StringComparison.OrdinalIgnoreCase));

        if (card.Disabled && !hasActionForCard)
        {
            // Some games (e.g. LAMA) expose playable cards through pending choices,
            // not via select_card/play_card actions tied to a hand cardId.
            // Let the view fallback submit the selected pending choice without announcing
            // a misleading "must draw first" message.
            if ((state.Pending?.Choices?.Count ?? 0) > 0)
            {
                return false;
            }

            MessageReceived?.Invoke(new GamePlayHistoryMessage(
                BuildHandPlayBlockedMessage(actions, card)));
            return false;
        }

        if (!hasActionForCard)
        {
            // Cat Pattes: play card directly if a matching play_card action exists.
            var playActions = actions
                .Where(action => string.Equals(action.Type, "play_card", StringComparison.OrdinalIgnoreCase))
                .Where(action => TryExtractCardId(action.Payload, out var payloadCardId) &&
                                 string.Equals(payloadCardId, card.CardId, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (playActions.Count == 1)
            {
                var chosen = playActions[0];
                await session.SendActionsAsync(
                        new[] { new GameClientAction(type: chosen.Type, payload: chosen.Payload) },
                        cancellationToken)
                    .ConfigureAwait(false);
                return true;
            }

            if (playActions.Count > 1)
            {
                var started = _choices.TryStartPlayCardSelection(
                    state,
                    card.CardId,
                    card.Label,
                    msg => MessageReceived?.Invoke(new GamePlayHistoryMessage(msg)));
                return started;
            }

            if ((state.Pending?.Choices?.Count ?? 0) > 0)
            {
                return false;
            }

            MessageReceived?.Invoke(new GamePlayHistoryMessage(
                BuildHandPlayBlockedMessage(actions, card)));
            return false;
        }

        await TrySendActionAsync("select_card", new { cardId = card.CardId }, cancellationToken).ConfigureAwait(false);
        return true;
    }

    public async Task<bool> DiscardSelectedHandCardAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator)
        {
            return false;
        }

        var session = _session;
        if (session == null || !session.IsConnected)
        {
            return false;
        }

        var card = GetSelectedHandCard();
        if (card == null)
        {
            return false;
        }

        var state = session.LastState;
        if (state == null)
        {
            return false;
        }

        var actions = state.Actions ?? new List<GameAvailableActionDto>();
        var discardAction = actions.FirstOrDefault(action =>
            string.Equals(action.Type, "discard_card", StringComparison.OrdinalIgnoreCase) &&
            TryExtractCardId(action.Payload, out var payloadCardId) &&
            string.Equals(payloadCardId, card.CardId, StringComparison.OrdinalIgnoreCase));

        if (discardAction == null || string.IsNullOrWhiteSpace(discardAction.Type))
        {
            var fallback = actions.FirstOrDefault(action =>
                string.Equals(action.Type, "discard_card", StringComparison.OrdinalIgnoreCase));
            if (fallback == null || string.IsNullOrWhiteSpace(fallback.Type))
            {
                return false;
            }

            var fallbackAction = new GameClientAction(type: fallback.Type, payload: new { cardId = card.CardId });
            var fallbackConfirmed = await ConfirmDiscardIfNeededAsync(fallbackAction, card.Label).ConfigureAwait(true);
            if (!fallbackConfirmed)
            {
                return true; // handled (user canceled)
            }

            await session.SendActionsAsync(new[] { fallbackAction }, cancellationToken).ConfigureAwait(false);
            return true;
        }

        var clientAction = new GameClientAction(type: discardAction.Type, payload: discardAction.Payload);
        var confirmed = await ConfirmDiscardIfNeededAsync(clientAction, card.Label).ConfigureAwait(true);
        if (!confirmed)
        {
            return true; // handled (user canceled)
        }

        await session.SendActionsAsync(new[] { clientAction }, cancellationToken).ConfigureAwait(false);
        return true;
    }

    private static string BuildHandPlayBlockedMessage(
        IReadOnlyCollection<GameAvailableActionDto> actions,
        HandCardLine card)
    {
        if (actions.Any(action => string.Equals(action.Type, "draw", StringComparison.OrdinalIgnoreCase)))
        {
            return "Vous devez d'abord piocher (Espace).";
        }

        var canDiscardSelected = actions.Any(action =>
            string.Equals(action.Type, "discard_card", StringComparison.OrdinalIgnoreCase) &&
            (!TryExtractCardId(action.Payload, out var payloadCardId) ||
             string.Equals(payloadCardId, card.CardId, StringComparison.OrdinalIgnoreCase)));
        if (canDiscardSelected)
        {
            return "Cette carte ne peut pas être jouée maintenant. Appuyez sur D pour la défausser.";
        }

        if (actions.Any(action => string.Equals(action.Type, "pass", StringComparison.OrdinalIgnoreCase)))
        {
            return "Cette carte ne peut pas être jouée maintenant. Passez votre tour.";
        }

        return "Cette carte ne peut pas être jouée maintenant.";
    }

    private void UpdateHandCards(IReadOnlyList<GamePlayExtrasParser.HandCardInfo> cards)
    {
        var previousCardId = GetSelectedHandCard()?.CardId;
        HandCards.Clear();

        foreach (var card in cards)
        {
            HandCards.Add(new HandCardLine(
                card.CardId,
                card.Label,
                card.Disabled,
                card.Color,
                card.Family,
                card.Index));
        }

        if (previousCardId != null)
        {
            for (var i = 0; i < HandCards.Count; i++)
            {
                if (string.Equals(HandCards[i].CardId, previousCardId, StringComparison.OrdinalIgnoreCase))
                {
                    SelectedHandIndex = i;
                    return;
                }
            }
        }

        SelectedHandIndex = HandCards.Count > 0 ? 0 : -1;
    }

    private static string BuildWaitingLabel(IReadOnlyList<int> waitingPlayers)
    {
        if (waitingPlayers == null || waitingPlayers.Count == 0)
        {
            return string.Empty;
        }

        return $"Joueurs en attente : {string.Join(", ", waitingPlayers)}";
    }

    private HandCardLine? GetSelectedHandCard()
    {
        if (SelectedHandIndex < 0 || SelectedHandIndex >= HandCards.Count)
        {
            return null;
        }

        return HandCards[SelectedHandIndex];
    }

    private static bool TryExtractCardId(JsonElement payload, out string cardId)
    {
        cardId = string.Empty;
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!payload.TryGetProperty("cardId", out var candidate) ||
            candidate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        var value = candidate.GetString();
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        cardId = value.Trim();
        return true;
    }

    public sealed class HandCardLine
    {
        public HandCardLine(string cardId, string label, bool disabled, string? color, string? family, int order)
        {
            CardId = cardId ?? string.Empty;
            Label = label ?? string.Empty;
            Disabled = disabled;
            Color = color;
            Family = family;
            Order = order;
        }

        public string CardId { get; }
        public string Label { get; }
        public bool Disabled { get; }
        public string? Color { get; }
        public string? Family { get; }
        public int Order { get; }
    }
}
