using System;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private DateTime _suppressChoiceAutoFocusUntilUtc;
    private bool _restoreChoiceFocusAfterSubmit;
    private int _restoreChoiceFocusIndex;

    private void NoteChoiceSubmittedForFocusRestore()
    {
        _suppressChoiceAutoFocusUntilUtc = DateTime.UtcNow.AddSeconds(1);
        _restoreChoiceFocusAfterSubmit = true;
        _restoreChoiceFocusIndex = ChoicesList?.SelectedIndex ?? -1;
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

        if (_vm != null && _vmPropertyChangedHandler != null)
        {
            _vm.PropertyChanged -= _vmPropertyChangedHandler;
        }

        _vm = vm;
        _choicesCollection = null;
        _choicesChanged = null;
        _focusRequestedHandler = null;
        _vmPropertyChangedHandler = null;

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

            _vmPropertyChangedHandler = (_, e) =>
            {
                // Quand la question de quiz apparaît/change, on veut la lire immédiatement.
                if (!string.Equals(e.PropertyName, nameof(GamePlayViewModel.QuizQuestionText), StringComparison.Ordinal) &&
                    !string.Equals(e.PropertyName, nameof(GamePlayViewModel.PendingType), StringComparison.Ordinal) &&
                    !string.Equals(e.PropertyName, nameof(GamePlayViewModel.IsQuizPending), StringComparison.Ordinal))
                {
                    return;
                }

                if (IsTextInputFocused())
                {
                    return;
                }

                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    UpdateChoicesAccessibility();
                    TryAutoFocusQuizQuestion();
                }));
            };
            _vm.PropertyChanged += _vmPropertyChangedHandler;
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

            // Après validation d'un choix (Entrée), la liste se met à jour (carte jouée/retirée).
            // Éviter de voler le focus / annoncer la nouvelle première ligne ("LAMA", etc.),
            // afin de laisser l'historique serveur annoncer l'action ("X joue un 3.").
            if (DateTime.UtcNow < _suppressChoiceAutoFocusUntilUtc)
            {
                if (_restoreChoiceFocusAfterSubmit)
                {
                    _restoreChoiceFocusAfterSubmit = false;
                    Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        try
                        {
                            if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count <= 0)
                            {
                                ForceFocusGameZone();
                                return;
                            }

                            var count = ChoicesList.Items.Count;
                            var idx = _restoreChoiceFocusIndex;
                            if (idx < 0) idx = 0;
                            if (idx >= count) idx = count - 1;

                            ChoicesList.SelectedIndex = idx;
                            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
                            TryFocusChoiceIndex(idx);
                        }
                        catch
                        {
                            // ignore
                        }
                    }));
                }
                return;
            }

            if (_vm.PendingChoices.Count <= 0)
            {
                // Quand les choix disparaissent (ex: quiz aprǸs rǸponse),
                // l'ǸlǸment focalisǸ peut Œtre dǸtruit par la virtualisation et WPF dǸporte le focus hors de la zone de jeu.
                // On rǸ-ancre le focus best-effort, sauf si l'utilisateur est dans une zone de saisie.
                if (!IsTextInputFocused() && (!IsKeyboardFocusWithin || ChoicesList.IsKeyboardFocusWithin))
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
                if (TryAutoFocusQuizQuestion())
                {
                    return;
                }

                TryFocusFirstChoice();
            }));
        };

        notify.CollectionChanged += _choicesChanged;
    }

    private bool TryAutoFocusQuizQuestion()
    {
        if (DataContext is not GamePlayViewModel vm || !vm.IsQuizPending)
        {
            _lastAutoFocusedQuizQuestionText = string.Empty;
            return false;
        }

        var question = (vm.QuizQuestionText ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(question))
        {
            return false;
        }

        if (string.Equals(_lastAutoFocusedQuizQuestionText, question, StringComparison.Ordinal))
        {
            return false;
        }

        _lastAutoFocusedQuizQuestionText = question;

        // Reset sélection: la 1ère pression sur ↓ doit arriver sur la 1ère réponse (index 0),
        // sans sauter directement à la 2e (index 1).
        if (ChoicesList.Visibility == Visibility.Visible && ChoicesList.Items.Count > 0)
        {
            ChoicesList.SelectedIndex = -1;

            // Warm-up virtualisation/layout : au tout premier quiz, l'utilisateur peut appuyer ↓
            // avant que le container ListBoxItem soit créé, ce qui empêche NVDA d'annoncer la 1ère réponse.
            try
            {
                ChoicesList.ScrollIntoView(ChoicesList.Items[0]);
                ChoicesList.UpdateLayout();
            }
            catch
            {
                // ignore
            }

            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                try
                {
                    if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count <= 0)
                    {
                        return;
                    }

                    ChoicesList.ScrollIntoView(ChoicesList.Items[0]);
                    ChoicesList.UpdateLayout();
                }
                catch
                {
                    // ignore
                }
            }));
        }

        // IMPORTANT: rester sur la question (ne pas voler le focus vers la liste).
        // L'accès aux réponses se fait ensuite via ↓ depuis la question.
        return TryFocusQuizQuestion();

        // Si les choix n'ont pas encore été reçus, on laisse le live region annoncer la question
        // et la navigation fléchée restera sur la liste dès qu'elle sera matérialisée.
        // (TryFocusQuizQuestion() renvoie false si la question n'est pas visible.)
    }

    private void UpdateChoicesAccessibility()
    {
        if (_vm == null)
        {
            return;
        }

        var label = string.IsNullOrWhiteSpace(_vm.ChoicesLabel) ? string.Empty : _vm.ChoicesLabel.Trim();

        // Quiz: la question est déjà l'ancre (focus). La liste ne doit pas être annoncée avec la question,
        // sinon NVDA relit la question à chaque navigation ↑/↓.
        if (_vm.IsQuizPending)
        {
            ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
            AutomationProperties.SetName(ChoicesList, "Réponses");
            ChoicesList.ClearValue(AutomationProperties.LabeledByProperty);
            return;
        }

        // NVDA utilise parfois LabeledBy plutôt que Name.
        // On force un libellé serveur (pending.label) et on évite HelpText (valeurs vides/null peuvent provoquer une erreur WPF).
        // On efface aussi tout HelpText défini via XAML/BAML (anciennes versions) pour éviter les annonces génériques.
        ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
        if (string.IsNullOrWhiteSpace(label))
        {
            // Fallback : donner un nom à la liste pour qu'elle soit correctement annoncée,
            // même si le serveur n'a pas fourni de label.
            if (_vm.IsQuizPending)
            {
                AutomationProperties.SetName(ChoicesList, "Réponses");
            }
            else
            {
                ChoicesList.ClearValue(AutomationProperties.NameProperty);
            }
        }
        else
        {
            AutomationProperties.SetName(ChoicesList, label);
        }

        // NOTE: On récupère le label via FindName pour éviter une dépendance au champ généré par le XAML,
        // qui peut ne pas être régénéré dans certains scénarios (build incrémentale / cache).
        if (!string.IsNullOrWhiteSpace(label) &&
            FindName("ChoicesLabelText") is FrameworkElement labelElement &&
            labelElement.Visibility == Visibility.Visible)
        {
            AutomationProperties.SetName(labelElement, label);
            AutomationProperties.SetLabeledBy(ChoicesList, labelElement);
            return;
        }

        ChoicesList.ClearValue(AutomationProperties.LabeledByProperty);
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
        if (DataContext is GamePlayViewModel vmPrompt && vmPrompt.HasInlinePrompt)
        {
            FocusFirstInlinePromptField();
            return;
        }

        // Le reset d'une table peut "casser" le focus (l'élément focusé est détruit/collapsé),
        // ce qui oblige ensuite à Tab/Maj+Tab. Ici on force un ancrage stable sur la zone de jeu.
        if (IsTextInputFocused())
        {
            return;
        }

        // Priorité UX :
        // - si une grille est visible: ancrer sur la grille (jeux type Corridor)
        // - sinon, si une liste de choix est visible: ancrer sur cette liste (ex: LAMA = main)
        // - sinon: ancrer sur la vue racine
        if (DataContext is GamePlayViewModel vm && vm.Grid.IsVisible)
        {
            Focus();
            Keyboard.Focus(this);
            TryFocusPreferredGridCell();
            return;
        }

        if (ChoicesList.Visibility == Visibility.Visible && ChoicesList.Items.Count > 0)
        {
            if (ChoicesList.SelectedIndex < 0)
            {
                ChoicesList.SelectedIndex = 0;
            }

            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
            ChoicesList.UpdateLayout();

            var idx = ChoicesList.SelectedIndex < 0 ? 0 : ChoicesList.SelectedIndex;
            if (ChoicesList.ItemContainerGenerator.ContainerFromIndex(idx) is ListBoxItem item)
            {
                item.Focus();
                Keyboard.Focus(item);
                return;
            }

            ChoicesList.Focus();
            Keyboard.Focus(ChoicesList);
            return;
        }

        Focus();
        Keyboard.Focus(this);
    }

    private async void OnChoicesKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key is not (Key.Enter or Key.Return))
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
                NoteChoiceSubmittedForFocusRestore();
            }
        }
        catch
        {
            e.Handled = true;
        }
    }
}
