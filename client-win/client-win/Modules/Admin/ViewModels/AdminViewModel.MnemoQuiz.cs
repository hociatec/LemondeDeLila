using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;
using Serilog;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task LoadMnemoQuizCategoriesAsync()
    {
        _page = AdminPage.MnemoQuizCategories;
        ConfigureItemsViewForPage();
        Title = "Quiz (Mnémosyne) - Catégories";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
        IsBusy = true;
        try
        {
            var list = await _admin.GetMnemoQuizCategoriesAsync().ConfigureAwait(true);
            _mnemoQuizCategories = (list.Categories ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                Items.Clear();
                foreach (var c in _mnemoQuizCategories.OrderBy(c => c.Name))
                {
                    Items.Add(new AdminMenuItem($"Catégorie : {c.Name}", tag: c));
                }
                Items.Add(new AdminMenuItem("Ajouter une catégorie", tag: "mnemo.category.create"));
                SelectedItem = Items.FirstOrDefault();
                Status = "Entrée : sélectionner. Échap : retour.";
                RestoreFocusIfAny();
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildMnemoQuizCategoryActions(AdminMnemoQuizCategoryDto category)
    {
        _page = AdminPage.MnemoQuizCategoryActions;
        ConfigureItemsViewForPage();
        _selectedMnemoQuizCategory = category;
        _selectedMnemoQuizQuestion = null;
        Title = $"Quiz (Mnémosyne) - {category.Name}";
        Details = $"Id: {category.Id}";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Questions", tag: "mnemo.questions.list"));
        Items.Add(new AdminMenuItem("Ajouter une question", tag: "mnemo.question.create"));
        Items.Add(new AdminMenuItem("Renommer la catégorie", tag: "mnemo.category.rename"));
        Items.Add(new AdminMenuItem("Supprimer la catégorie", tag: "mnemo.category.delete"));
        Items.Add(new AdminMenuItem("Retour", tag: "mnemo.back"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        RestoreFocusIfAny();
    }

    private async Task ExecuteMnemoQuizCategoryActionAsync(AdminMnemoQuizCategoryDto category, string action)
    {
        if (action == "mnemo.back")
        {
            await LoadMnemoQuizCategoriesAsync().ConfigureAwait(true);
            return;
        }

        if (action == "mnemo.category.rename")
        {
            BuildMnemoQuizEditText(
                title: $"Renommer : {category.Name}",
                label: "Nouveau nom",
                initialValue: category.Name,
                mode: "mnemo.category.rename");
            return;
        }

        if (action == "mnemo.category.delete")
        {
            var confirm = await _dialogs.Confirm("Supprimer", $"Supprimer la catégorie \"{category.Name}\" ? (Les questions seront mises à la corbeille)").ConfigureAwait(true);
            if (confirm != true) return;
            IsBusy = true;
            try
            {
                var updated = await _admin.DeleteMnemoQuizCategoryAsync(category.Id).ConfigureAwait(true);
                _mnemoQuizCategories = (updated.Categories ?? new()).ToArray();
                await LoadMnemoQuizCategoriesAsync().ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (action == "mnemo.question.create")
        {
            BuildMnemoQuizEditText(
                title: $"Ajouter une question ({category.Name})",
                label: "5 lignes : Question, Bonne réponse, Mauvaise 1, Mauvaise 2, Mauvaise 3",
                initialValue: string.Empty,
                mode: "mnemo.question.create");
            return;
        }

        if (action == "mnemo.questions.list")
        {
            await LoadMnemoQuizQuestionsAsync(category.Id, status: null).ConfigureAwait(true);
            return;
        }

        // Filtrage par statut supprimé (UI simplifiée).
    }

    private async Task LoadMnemoQuizQuestionsAsync(string categoryId, string? status)
    {
        _page = AdminPage.MnemoQuizQuestions;
        ConfigureItemsViewForPage();
        var statusLabel = string.IsNullOrWhiteSpace(status) ? "toutes" : status;
        Title = $"Quiz (Mnémosyne) - Questions ({statusLabel})";
        Details = $"Catégorie: {categoryId}";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
        IsBusy = true;
        try
        {
            var list = await _admin.GetMnemoQuizQuestionsAsync(categoryId, status).ConfigureAwait(true);
            _mnemoQuizQuestions = (list.Questions ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                Items.Clear();
                foreach (var q in _mnemoQuizQuestions.OrderByDescending(q => q.UpdatedAt))
                {
                    var label = q.Question?.Trim() ?? string.Empty;
                    if (label.Length > 90) label = label[..87] + "...";
                    Items.Add(new AdminMenuItem(label.Length > 0 ? label : "(question vide)", tag: q));
                }
                Items.Add(new AdminMenuItem("Retour", tag: "mnemo.back"));
                SelectedItem = Items.FirstOrDefault();
                Status = "Entrée : sélectionner. Échap : retour.";
                RestoreFocusIfAny();
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildMnemoQuizQuestionActions(AdminMnemoQuizQuestionDto question)
    {
        _page = AdminPage.MnemoQuizQuestionActions;
        ConfigureItemsViewForPage();
        _selectedMnemoQuizQuestion = question;
        Title = "Quiz (Mnémosyne) - Question";
        var answers = (question.Answers ?? new()).ToArray();
        Details =
            $"Id: {question.Id}\n\nQ: {question.Question}\n\n" +
            $"R1 (bonne): {(answers.Length > 0 ? answers[0] : string.Empty)}\n" +
            $"R2: {(answers.Length > 1 ? answers[1] : string.Empty)}\n" +
            $"R3: {(answers.Length > 2 ? answers[2] : string.Empty)}\n" +
            $"R4: {(answers.Length > 3 ? answers[3] : string.Empty)}";

        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Modifier la question", tag: "mnemo.question.edit"));
        Items.Add(new AdminMenuItem("Supprimer définitivement", tag: "mnemo.question.delete"));
        Items.Add(new AdminMenuItem("Retour", tag: "mnemo.back"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        RestoreFocusIfAny();
    }

    private async Task ExecuteMnemoQuizQuestionActionAsync(AdminMnemoQuizQuestionDto question, string action)
    {
        if (action == "mnemo.back")
        {
            if (_selectedMnemoQuizCategory != null)
            {
                await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, status: null).ConfigureAwait(true);
            }
            else
            {
                ShowGames();
            }
            return;
        }

        if (action == "mnemo.question.edit")
        {
            var answers = (question.Answers ?? new()).ToArray();
            var block = string.Join("\n", new[]
            {
                question.Question ?? string.Empty,
                answers.Length > 0 ? answers[0] : string.Empty,
                answers.Length > 1 ? answers[1] : string.Empty,
                answers.Length > 2 ? answers[2] : string.Empty,
                answers.Length > 3 ? answers[3] : string.Empty,
            });
            BuildMnemoQuizEditText(
                title: "Modifier la question",
                label: "5 lignes : Question, Bonne réponse, Mauvaise 1, Mauvaise 2, Mauvaise 3",
                initialValue: block,
                mode: "mnemo.question.edit");
            return;
        }

        if (action == "mnemo.question.delete")
        {
            var confirm = await _dialogs.Confirm("Supprimer", "Supprimer définitivement cette question ?").ConfigureAwait(true);
            if (confirm != true) return;
            IsBusy = true;
            try
            {
                await _admin.DeleteMnemoQuizQuestionAsync(question.Id).ConfigureAwait(true);
                if (_selectedMnemoQuizCategory != null)
                {
                    await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, status: null).ConfigureAwait(true);
                }
            }
            finally
            {
                IsBusy = false;
            }
        }
    }

    private void BuildMnemoQuizCategoryCreate()
    {
        _selectedMnemoQuizCategory = null;
        _selectedMnemoQuizQuestion = null;
        BuildMnemoQuizEditText(
            title: "Quiz (Mnémosyne) - Ajouter une catégorie",
            label: "Nom de catégorie",
            initialValue: string.Empty,
            mode: "mnemo.category.create");
    }

    private void BuildMnemoQuizEditText(string title, string label, string initialValue, string mode)
    {
        if (string.Equals(mode, "mnemo.question.create", StringComparison.OrdinalIgnoreCase))
        {
            BuildMnemoQuizQuestionForm(
                title: title,
                question: string.Empty,
                correct: string.Empty,
                wrong1: string.Empty,
                wrong2: string.Empty,
                wrong3: string.Empty,
                mode: mode);
            return;
        }

        if (string.Equals(mode, "mnemo.question.edit", StringComparison.OrdinalIgnoreCase) &&
            _selectedMnemoQuizQuestion != null)
        {
            var answers = _selectedMnemoQuizQuestion.Answers ?? new();
            BuildMnemoQuizQuestionForm(
                title: title,
                question: _selectedMnemoQuizQuestion.Question ?? string.Empty,
                correct: answers.ElementAtOrDefault(0) ?? string.Empty,
                wrong1: answers.ElementAtOrDefault(1) ?? string.Empty,
                wrong2: answers.ElementAtOrDefault(2) ?? string.Empty,
                wrong3: answers.ElementAtOrDefault(3) ?? string.Empty,
                mode: mode);
            return;
        }

        _page = AdminPage.EditText;
        Title = title;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "mnemo.edit.submit"));
        SelectedItem = Items.FirstOrDefault();
        PrimaryInputAcceptsReturn = true;
        TextInputLabel = label;
        TextInput = initialValue;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        ThirdInputLabel = string.Empty;
        ThirdInput = string.Empty;
        FourthInputLabel = string.Empty;
        FourthInput = string.Empty;
        FifthInputLabel = string.Empty;
        FifthInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        IsThirdInputVisible = false;
        IsFourthInputVisible = false;
        IsFifthInputVisible = false;
        Details = string.Empty;
        Status = "Saisissez puis Entrée pour valider. Échap : retour.";
        _currentEditMode = mode;
        RestoreFocusIfAny();

        try
        {
            Log.Information(
                "MnemoQuiz: question form fields primary={Primary} secondary={Secondary} third={Third} fourth={Fourth} fifth={Fifth} mode={Mode}",
                IsTextInputVisible,
                IsSecondaryInputVisible,
                IsThirdInputVisible,
                IsFourthInputVisible,
                IsFifthInputVisible,
                mode);
        }
        catch
        {
            // ignore
        }
    }

    private void BuildMnemoQuizQuestionForm(
        string title,
        string question,
        string correct,
        string wrong1,
        string wrong2,
        string wrong3,
        string mode)
    {
        _page = AdminPage.EditText;
        Title = title;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "mnemo.edit.submit"));
        SelectedItem = Items.FirstOrDefault();
        PrimaryInputAcceptsReturn = false;
        TextInputLabel = "Question";
        TextInput = question ?? string.Empty;
        SecondaryInputLabel = "Bonne réponse";
        SecondaryInput = correct ?? string.Empty;
        SecondaryInputAcceptsReturn = false;
        ThirdInputLabel = "Réponse 1";
        ThirdInput = wrong1 ?? string.Empty;
        FourthInputLabel = "Réponse 2";
        FourthInput = wrong2 ?? string.Empty;
        FifthInputLabel = "Réponse 3";
        FifthInput = wrong3 ?? string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsThirdInputVisible = true;
        IsFourthInputVisible = true;
        IsFifthInputVisible = true;
        Details = string.Empty;
        Status = "Tab : champ suivant. Entrée : valider. Échap : retour.";
        _currentEditMode = mode;
        RestoreFocusIfAny();
    }
    private async Task SubmitMnemoQuizEditAsync()
    {
        var mode = _currentEditMode ?? string.Empty;
        var value = TextInput ?? string.Empty;

        if (mode == "mnemo.category.create")
        {
            var name = value.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                await _dialogs.ShowError("Quiz", "Nom de catégorie requis.").ConfigureAwait(true);
                return;
            }
            IsBusy = true;
            try
            {
                var updated = await _admin.CreateMnemoQuizCategoryAsync(name).ConfigureAwait(true);
                _mnemoQuizCategories = (updated.Categories ?? new()).ToArray();
                await LoadMnemoQuizCategoriesAsync().ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (mode == "mnemo.category.rename" && _selectedMnemoQuizCategory != null)
        {
            var name = value.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                await _dialogs.ShowError("Quiz", "Nom de catégorie requis.").ConfigureAwait(true);
                return;
            }
            IsBusy = true;
            try
            {
                var updated = await _admin.UpdateMnemoQuizCategoryAsync(_selectedMnemoQuizCategory.Id, name).ConfigureAwait(true);
                _mnemoQuizCategories = (updated.Categories ?? new()).ToArray();
                await LoadMnemoQuizCategoriesAsync().ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (mode == "mnemo.question.create" && _selectedMnemoQuizCategory != null)
        {
            var q = (TextInput ?? string.Empty).Trim();
            var correct = (SecondaryInput ?? string.Empty).Trim();
            var wrong1 = (ThirdInput ?? string.Empty).Trim();
            var wrong2 = (FourthInput ?? string.Empty).Trim();
            var wrong3 = (FifthInput ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(q) ||
                string.IsNullOrWhiteSpace(correct) ||
                string.IsNullOrWhiteSpace(wrong1) ||
                string.IsNullOrWhiteSpace(wrong2) ||
                string.IsNullOrWhiteSpace(wrong3))
            {
                await _dialogs.ShowError("Quiz", "Tous les champs sont requis.").ConfigureAwait(true);
                return;
            }
            var answers = new[] { correct, wrong1, wrong2, wrong3 };
            IsBusy = true;
            try
            {
                await _admin.CreateMnemoQuizQuestionAsync(_selectedMnemoQuizCategory.Id, q, answers, correctIndex: 0, status: "validated").ConfigureAwait(true);
                await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, status: null).ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (mode == "mnemo.question.edit" && _selectedMnemoQuizCategory != null && _selectedMnemoQuizQuestion != null)
        {
            var q = (TextInput ?? string.Empty).Trim();
            var correct = (SecondaryInput ?? string.Empty).Trim();
            var wrong1 = (ThirdInput ?? string.Empty).Trim();
            var wrong2 = (FourthInput ?? string.Empty).Trim();
            var wrong3 = (FifthInput ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(q) ||
                string.IsNullOrWhiteSpace(correct) ||
                string.IsNullOrWhiteSpace(wrong1) ||
                string.IsNullOrWhiteSpace(wrong2) ||
                string.IsNullOrWhiteSpace(wrong3))
            {
                await _dialogs.ShowError("Quiz", "Tous les champs sont requis.").ConfigureAwait(true);
                return;
            }
            var answers = new[] { correct, wrong1, wrong2, wrong3 };
            IsBusy = true;
            try
            {
                await _admin.UpdateMnemoQuizQuestionAsync(_selectedMnemoQuizQuestion.Id, question: q, answers: answers, correctIndex: 0).ConfigureAwait(true);
                await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, status: null).ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}



