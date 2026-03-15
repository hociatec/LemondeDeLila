using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Actions.Services;
using client_win.Modules.Game.Play.Choices.ViewModels;
using client_win.Modules.Game.Play.GamePlay.Dtos;
using client_win.Modules.Game.Play.GamePlay.Services;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Play.Grid.ViewModels;
using client_win.Modules.Game.Play.Grid.Views;
using client_win.Modules.Game.Play.Panels.Services;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Shell.Services;
using client_win.Modules.TextPrompts.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayViewFocusTests
{
    [Theory]
    [InlineData(Key.Enter, true)]
    [InlineData(Key.Space, true)]
    [InlineData(Key.A, true)]
    [InlineData(Key.D5, true)]
    [InlineData(Key.Down, false)]
    [InlineData(Key.Tab, false)]
    public void IsRepeatSensitiveActionKey_MatchesGameplaySubmissionKeys(Key key, bool expected)
    {
        Assert.Equal(expected, GamePlayView.IsRepeatSensitiveActionKey(key));
    }

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
    public void InteractiveListFocus_StaysOnListRoot_WhenEnteringViaTab()
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

                var choicesList = Assert.IsType<ListBox>(view.FindName("ChoicesList"));
                choicesList.Visibility = Visibility.Visible;
                choicesList.ItemsSource = new ObservableCollection<ChoiceItem>
                {
                    new("Choix 1"),
                    new("Choix 2"),
                };

                view.UpdateLayout();
                choicesList.Focus();
                Keyboard.Focus(choicesList);
                StaDispatcherHarness.Drain(dispatcher);

                Assert.True(IsFocusWithin(choicesList));
                Assert.Equal(0, choicesList.SelectedIndex);
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
    public void FocusPreferredInteractiveElement_NonForced_RecoversFromGameRootToChoices()
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
                    new("Donner tomate"),
                    new("Refuser"),
                };

                view.UpdateLayout();
                view.Focus();
                Keyboard.Focus(view);
                Assert.True(IsFocusWithin(view));
                Assert.False(IsFocusWithin(choicesList));

                view.FocusPreferredInteractiveElement(forceFromOutsideTextInput: false);

                Assert.True(StaDispatcherHarness.WaitUntil(() => IsFocusWithin(choicesList), dispatcher, 2200));
            }
            finally
            {
                window.Close();
            }
        });
    }

    [Fact]
    public void PendingChoices_AppearWhileFocusOnGameRoot_FocusesChoicesList()
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

                var choicesList = Assert.IsType<ListBox>(view.FindName("ChoicesList"));
                var choices = new ObservableCollection<ChoiceItem>();
                choicesList.ItemsSource = choices;

                view.Focus();
                Keyboard.Focus(view);
                Assert.True(IsFocusWithin(view));
                Assert.False(IsFocusWithin(choicesList));

                choices.Add(new ChoiceItem("Azrael"));
                choices.Add(new ChoiceItem("Scoop"));
                view.UpdateLayout();
                StaDispatcherHarness.Drain(dispatcher);

                Assert.True(StaDispatcherHarness.WaitUntil(
                    () => choicesList.Items.Count == 2,
                    dispatcher,
                    2200));

                view.FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);

                Assert.True(StaDispatcherHarness.WaitUntil(
                    () => IsFocusWithin(choicesList),
                    dispatcher,
                    2200));
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

    [Fact]
    public void GamePlayLogSoundPlayer_SuppressesDrawSoundWhenDiceWasLoggedInSameBatch()
    {
        var sounds = new RecordingSoundService();
        var assembly = typeof(GamePlayView).Assembly;
        var type = assembly.GetType("client_win.Modules.Game.Play.GamePlay.Services.GamePlayLogSoundPlayer");
        Assert.NotNull(type);

        var ctor = type!.GetConstructor(
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
            binder: null,
            types: [typeof(ISoundService)],
            modifiers: null);
        Assert.NotNull(ctor);

        var player = ctor!.Invoke([sounds]);
        Assert.NotNull(player);

        var method = type!.GetMethod(
            "TryPlayForLogMessage",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);

        method!.Invoke(player, new object?[] { "A pioche une tomate.", null, true });
        Assert.DoesNotContain(SoundId.DrawCard, sounds.PlayedSounds);

        method.Invoke(player, new object?[] { "A pioche une tomate.", null, false });
        Assert.Contains(SoundId.DrawCard, sounds.PlayedSounds);
    }

    [Fact]
    public void RealtimeController_RequestsFocusWhenPendingStepChangesWithinSameActionableTurn()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var focusRequests = 0;
            var sounds = new RecordingSoundService();
            var controller = CreateRealtimeController(dispatcher, sounds, () => focusRequests++);

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: "exchange",
                label: "Choisissez un joueur pour le troc.",
                choices: ["Mouche", "Lila"]));

            Assert.True(StaDispatcherHarness.WaitUntil(() => focusRequests == 1, dispatcher, 1200));
            StaDispatcherHarness.Drain(dispatcher);

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: "exchange",
                label: "Choisissez la carte à offrir.",
                choices: ["melon", "mangue"]));

            Assert.True(StaDispatcherHarness.WaitUntil(() => focusRequests == 2, dispatcher, 1200));
            StaDispatcherHarness.Drain(dispatcher);

            Assert.Equal(2, focusRequests);
        });
    }

    [Fact]
    public void RealtimeController_DoesNotAnnounceTurnLocallyWhenPawnSelectionEnds()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var sounds = new RecordingSoundService();
            var emittedMessages = new List<GamePlayHistoryMessage>();
            var controller = CreateRealtimeController(
                dispatcher,
                sounds,
                emitMessage: message => emittedMessages.Add(message));

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: "pick_pawn",
                label: "Choisissez un pion.",
                choices: ["Lutin", "Fée"]));
            StaDispatcherHarness.Drain(dispatcher);
            emittedMessages.Clear();

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: string.Empty,
                label: string.Empty,
                choices: [],
                turnIndex: 1));

            StaDispatcherHarness.Drain(dispatcher);

            Assert.DoesNotContain(
                emittedMessages,
                m => string.Equals(m.Message, "C'est au tour de Mouche.", StringComparison.Ordinal));
        });
    }

    [Fact]
    public void RealtimeController_PrefersDiceSoundOverDrawSoundWhenRollAndDrawShareSameBatch()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var sounds = new RecordingSoundService();
            var controller = CreateRealtimeController(dispatcher, sounds);

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: string.Empty,
                label: string.Empty,
                choices: [],
                turnIndex: 2));
            StaDispatcherHarness.Drain(dispatcher);

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: string.Empty,
                label: string.Empty,
                choices: [],
                turnIndex: 3,
                lastRoll: 4,
                logMessages:
                [
                    new GameLogEntryDto("Mouche lance le dé : \"4\"", "2026-03-08T12:00:00Z"),
                    new GameLogEntryDto("[Panier Express] Mouche pioche \"melon\".", "2026-03-08T12:00:01Z"),
                ]));

            Assert.True(StaDispatcherHarness.WaitUntil(
                () => sounds.PlayedSounds.Contains(SoundId.DiceRolled),
                dispatcher,
                1200));
            StaDispatcherHarness.Drain(dispatcher);

            Assert.Contains(SoundId.DiceRolled, sounds.PlayedSounds);
            Assert.DoesNotContain(SoundId.DrawCard, sounds.PlayedSounds);
        });
    }

    [Fact]
    public void RealtimeController_EmitsEveryNonDiceLogMessageInSameBatch()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var sounds = new RecordingSoundService();
            var emittedMessages = new List<GamePlayHistoryMessage>();
            var controller = CreateRealtimeController(
                dispatcher,
                sounds,
                emitMessage: message => emittedMessages.Add(message));

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: string.Empty,
                label: string.Empty,
                choices: [],
                turnIndex: 1));
            StaDispatcherHarness.Drain(dispatcher);
            emittedMessages.Clear();

            controller.HandleStateUpdated(CreatePendingState(
                pendingType: string.Empty,
                label: string.Empty,
                choices: [],
                turnIndex: 1,
                logMessages:
                [
                    new GameLogEntryDto("Mouche pioche Croquettes.", "2026-03-08T12:00:00Z"),
                    new GameLogEntryDto("Mouche joue Croquettes.", "2026-03-08T12:00:01Z"),
                ]));

            Assert.True(StaDispatcherHarness.WaitUntil(() => emittedMessages.Count == 2, dispatcher, 1200));
            StaDispatcherHarness.Drain(dispatcher);

            Assert.Collection(
                emittedMessages,
                message => Assert.Equal("Vous piochez Croquettes.", message.Message),
                message => Assert.Equal("Vous jouez Croquettes.", message.Message));
        });
    }

    [Fact]
    public void SubmitSelectedHandCardAsync_CatPattes_SendsDirectPlayCardAction()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var socket = new RecordingSocket();
            var state = CreateCatPattesHandState(
                cardId: "obstacle-pluie-1",
                cardLabel: "Pluie torrentielle",
                actions:
                [
                    new GameAvailableActionDto
                    {
                        Type = "play_card",
                        Payload = JsonSerializer.SerializeToElement(new
                        {
                            cardId = "obstacle-pluie-1",
                            targetPlayerId = 2,
                        }),
                    },
                ]);
            using var scope = CreateGamePlayViewModelScope(dispatcher, socket, state);

            scope.ViewModel.SyncHandFromState(state);
            scope.ViewModel.SelectedHandIndex = 0;

            var handled = scope.ViewModel
                .SubmitSelectedHandCardAsync()
                .GetAwaiter()
                .GetResult();

            Assert.True(handled);
            Assert.Contains(
                socket.SentMessages,
                message =>
                    message.Contains("\"type\":\"game.actions\"", StringComparison.Ordinal) &&
                    message.Contains("\"play_card\"", StringComparison.Ordinal) &&
                    message.Contains("\"obstacle-pluie-1\"", StringComparison.Ordinal));
        });
    }

    [Fact]
    public void SubmitSelectedHandCardAsync_CatPattes_OpensTargetChoicesWhenSeveralPlayActionsExist()
    {
        StaDispatcherHarness.Run(dispatcher =>
        {
            var socket = new RecordingSocket();
            var state = CreateCatPattesHandState(
                cardId: "obstacle-pluie-1",
                cardLabel: "Pluie torrentielle",
                playerNames: new Dictionary<int, string>
                {
                    [1] = "Mouche",
                    [2] = "Lila",
                    [3] = "Nina",
                },
                actions:
                [
                    new GameAvailableActionDto
                    {
                        Type = "play_card",
                        Payload = JsonSerializer.SerializeToElement(new
                        {
                            cardId = "obstacle-pluie-1",
                            targetPlayerId = 2,
                        }),
                    },
                    new GameAvailableActionDto
                    {
                        Type = "play_card",
                        Payload = JsonSerializer.SerializeToElement(new
                        {
                            cardId = "obstacle-pluie-1",
                            targetPlayerId = 3,
                        }),
                    },
                ]);
            using var scope = CreateGamePlayViewModelScope(dispatcher, socket, state);

            scope.ViewModel.SyncHandFromState(state);
            scope.ViewModel.SelectedHandIndex = 0;

            var handled = scope.ViewModel
                .SubmitSelectedHandCardAsync()
                .GetAwaiter()
                .GetResult();

            Assert.True(handled);
            Assert.DoesNotContain(
                socket.SentMessages,
                message => message.Contains("\"type\":\"game.actions\"", StringComparison.Ordinal));
            Assert.Equal(2, scope.ViewModel.PendingChoices.Count);
            Assert.Contains("Sur Lila", scope.ViewModel.PendingChoices);
            Assert.Contains("Sur Nina", scope.ViewModel.PendingChoices);
            Assert.Equal(
                "Choisissez une cible pour Pluie torrentielle, puis Entrée.",
                scope.ViewModel.ChoicesLabel);
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

    private static GamePlayRealtimeController CreateRealtimeController(
        Dispatcher dispatcher,
        RecordingSoundService sounds,
        Action? requestFocus = null,
        Action<GamePlayHistoryMessage>? emitMessage = null)
    {
        var projector = new GamePlayStateProjector();

        return new GamePlayRealtimeController(
            dispatcher: dispatcher,
            panels: new GamePlayPanelRequester(),
            projector: projector,
            presenter: new GamePlayStatePresenter(projector),
            endgameSounds: new GamePlayEndgameSoundPlayer(sounds),
            diceSounds: new GamePlayDiceSoundPlayer(sounds),
            logSounds: new GamePlayLogSoundPlayer(sounds),
            choices: new GamePlayChoicesViewModel(new GamePlayActionDispatcher()),
            grid: new GridBoardViewModel(
                dialogs: new FakeDialogService(),
                sounds: sounds,
                getSession: () => null,
                canInteract: () => true,
                gameId: "panier-express",
                announce: _ => { }),
            syncShortcuts: _ => { },
            canStartAskCardSelection: _ => false,
            emitMessage: emitMessage ?? (_ => { }),
            requestFocus: requestFocus ?? (() => { }),
            refreshCanExecute: () => { },
            onGameStatusChanged: (_, _) => { },
            onStartReadyChanged: _ => { },
            setIsBotThinking: _ => { },
            setStateSummary: _ => { },
            setPendingText: _ => { },
            setActionsText: _ => { },
            setBoardText: _ => { });
    }

    private static GamePlayViewModelScope CreateGamePlayViewModelScope(
        Dispatcher dispatcher,
        RecordingSocket socket,
        GameStateDto state)
    {
        var session = new GameSession(roomId: 1, gameType: "cat-pattes", socket);
        session.StopKeepAlive();
        SetSessionLastState(session, state);

        var viewModel = new GamePlayViewModel(
            gameId: "cat-pattes",
            connect: _ => Task.FromResult(session),
            dialogs: new FakeDialogService(),
            textPrompts: new FakeTextPromptService(),
            sounds: new RecordingSoundService());

        var sessionField = typeof(GamePlayViewModel).GetField(
            "_session",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(sessionField);
        sessionField!.SetValue(viewModel, session);

        return new GamePlayViewModelScope(viewModel);
    }

    private static void SetSessionLastState(GameSession session, GameStateDto state)
    {
        var property = typeof(GameSession).GetProperty(
            "LastState",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        Assert.NotNull(property);
        property!.SetValue(session, state);
    }

    private static GameStateDto CreateCatPattesHandState(
        string cardId,
        string cardLabel,
        IReadOnlyList<GameAvailableActionDto> actions,
        IReadOnlyDictionary<int, string>? playerNames = null)
    {
        var names = playerNames ?? new Dictionary<int, string>
        {
            [1] = "Mouche",
            [2] = "Lila",
        };

        return new GameStateDto
        {
            Status = "started",
            Phase = "turn",
            TurnIndex = 1,
            Players = new List<GamePlayerDto>(
                names.Select(entry => new GamePlayerDto
                {
                    Id = entry.Key,
                    Username = entry.Value,
                })),
            Turn = new GameTurnDto
            {
                CurrentPlayerId = 1,
            },
            Actions = new List<GameAvailableActionDto>(actions),
            Metadata = JsonSerializer.SerializeToElement(new
            {
                lifecycle = new
                {
                    startReady = false,
                    viewerTurnActionable = true,
                    viewerMustChoosePawn = false,
                },
            }),
            Extras = JsonSerializer.SerializeToElement(new
            {
                viewerPlayerId = 1,
                hand = new[]
                {
                    new
                    {
                        id = cardId,
                        label = cardLabel,
                        disabled = false,
                    },
                },
                handIds = new[] { cardId },
            }),
        };
    }

    private static GameStateDto CreatePendingState(
        string pendingType,
        string label,
        IReadOnlyList<string> choices,
        int turnIndex = 1,
        int? lastRoll = null,
        IReadOnlyList<GameLogEntryDto>? logMessages = null)
    {
        var pendingChoices = new List<string>(choices ?? Array.Empty<string>());
        return new GameStateDto
        {
            Status = "started",
            Phase = "play",
            TurnIndex = turnIndex,
            LastRoll = lastRoll,
            Players =
            [
                new GamePlayerDto
                {
                    Id = 1,
                    Username = "Mouche",
                },
            ],
            Turn = new GameTurnDto
            {
                CurrentPlayerId = 1,
            },
            Pending = string.IsNullOrWhiteSpace(pendingType)
                ? null
                : new GamePendingDto
                {
                    Type = pendingType,
                    Label = label,
                    PlayerId = 1,
                    Blocking = true,
                    Choices = pendingChoices,
                    Data = JsonSerializer.SerializeToElement(new
                    {
                        step = label,
                    }),
                },
            Actions = BuildPendingActions(pendingType, pendingChoices),
            Log = logMessages == null ? new List<GameLogEntryDto>() : new List<GameLogEntryDto>(logMessages),
            Metadata = JsonSerializer.SerializeToElement(new
            {
                lifecycle = new
                {
                    startReady = false,
                    viewerTurnActionable = true,
                    viewerMustChoosePawn = false,
                },
            }),
            Extras = JsonSerializer.SerializeToElement(new
            {
                viewerPlayerId = 1,
            }),
        };
    }

    private static List<GameAvailableActionDto> BuildPendingActions(
        string pendingType,
        IReadOnlyList<string> choices)
    {
        if (string.Equals(pendingType, "exchange", StringComparison.OrdinalIgnoreCase))
        {
            return
            [
                new GameAvailableActionDto
                {
                    Type = "exchange_accept",
                },
                new GameAvailableActionDto
                {
                    Type = "exchange_refuse",
                },
            ];
        }

        if (string.Equals(pendingType, "quiz", StringComparison.OrdinalIgnoreCase))
        {
            var actions = new List<GameAvailableActionDto>();
            for (var i = 0; i < choices.Count; i++)
            {
                actions.Add(new GameAvailableActionDto
                {
                    Type = "answer_quiz",
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        answerIndex = i,
                        answer = choices[i],
                    }),
                });
            }

            return actions;
        }

        return new List<GameAvailableActionDto>();
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

    private sealed class FakeDialogService : IDialogService
    {
        public Task ShowError(string title, string message) => Task.CompletedTask;
        public Task ShowInfo(string title, string message) => Task.CompletedTask;
        public Task<bool?> Confirm(string title, string message, string? okText = null, string? cancelText = null) => Task.FromResult<bool?>(true);
        public Task<DialogChoice?> Choose(string title, string message, string primaryText, string secondaryText, string cancelText) => Task.FromResult<DialogChoice?>(null);
        public Task<string?> Pick(string title, string message, IReadOnlyList<string> options, string? okText = null, string? cancelText = null) => Task.FromResult<string?>(null);
    }

    private sealed class FakeTextPromptService : ITextPromptService
    {
        public Task<string?> PromptAsync(string title, string label, string initialText) => Task.FromResult<string?>(null);

        public Task<(string Subject, string Message)?> PromptPrivateMessageAsync(
            string title,
            string subjectLabel,
            string messageLabel,
            string initialSubject,
            string initialMessage) => Task.FromResult<(string Subject, string Message)?>(null);
    }

    private sealed class RecordingSoundService : ISoundService
    {
        public List<SoundId> PlayedSounds { get; } = new();

        public void Play(SoundId sound) => PlayedSounds.Add(sound);
        public void Stop(SoundId sound) { }
        public void PlayPreview(SoundId sound) { }
        public void StopPreview() { }
        public void SetConnected(bool connected) { }
        public void OpenStartupGateForApp(string reason) { }
        public void StartLoop(SoundId sound) { }
        public void StopLoop(SoundId sound) { }
        public void StopLoopImmediate(SoundId sound) { }
        public TimeSpan? TryGetSoundDuration(SoundId sound) => null;
        public Task WaitForSoundToEndAsync(SoundId sound, TimeSpan timeout, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task WarmUpAsync(SoundId sound, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Preload(SoundId sound, bool warmUp = false) { }
        public void PreloadImmediate(SoundId sound, bool warmUp = false) { }
        public void PreloadAll() { }
    }

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

        public List<string> SentMessages { get; } = new();

        public Task ConnectAsync(Uri endpoint, string? token = null, IDictionary<string, string>? headers = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendAsync(string message, CancellationToken cancellationToken = default)
        {
            SentMessages.Add(message);
            return Task.CompletedTask;
        }
        public Task CloseAsync() => Task.CompletedTask;
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    private sealed class GamePlayViewModelScope : IDisposable
    {
        public GamePlayViewModelScope(GamePlayViewModel viewModel)
        {
            ViewModel = viewModel;
        }

        public GamePlayViewModel ViewModel { get; }

        public void Dispose()
        {
            ViewModel.DisposeAsync().AsTask().GetAwaiter().GetResult();
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
