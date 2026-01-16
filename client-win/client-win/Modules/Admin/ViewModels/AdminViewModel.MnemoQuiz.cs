using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

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
        Items.Add(new AdminMenuItem("Lister : Validées", tag: "mnemo.questions.validated"));
        Items.Add(new AdminMenuItem("Lister : En attente", tag: "mnemo.questions.pending"));
        Items.Add(new AdminMenuItem("Lister : À modifier", tag: "mnemo.questions.to_edit"));
        Items.Add(new AdminMenuItem("Lister : Corbeille", tag: "mnemo.questions.trash"));
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

        if (action.StartsWith("mnemo.questions.", StringComparison.OrdinalIgnoreCase))
        {
            var status = action["mnemo.questions.".Length..];
            _mnemoQuizStatusFilter = status;
            await LoadMnemoQuizQuestionsAsync(category.Id, status).ConfigureAwait(true);
        }
    }

    private async Task LoadMnemoQuizQuestionsAsync(string categoryId, string status)
    {
        _page = AdminPage.MnemoQuizQuestions;
        ConfigureItemsViewForPage();
        Title = $"Quiz (Mnémosyne) - Questions ({status})";
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
            $"Id: {question.Id}\nStatut: {question.Status}\n\nQ: {question.Question}\n\n" +
            $"R1 (bonne): {(answers.Length > 0 ? answers[0] : string.Empty)}\n" +
            $"R2: {(answers.Length > 1 ? answers[1] : string.Empty)}\n" +
            $"R3: {(answers.Length > 2 ? answers[2] : string.Empty)}\n" +
            $"R4: {(answers.Length > 3 ? answers[3] : string.Empty)}";

        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Modifier la question", tag: "mnemo.question.edit"));
        Items.Add(new AdminMenuItem("Statut : Validée", tag: "mnemo.question.status.validated"));
        Items.Add(new AdminMenuItem("Statut : En attente", tag: "mnemo.question.status.pending"));
        Items.Add(new AdminMenuItem("Statut : À modifier", tag: "mnemo.question.status.to_edit"));
        Items.Add(new AdminMenuItem("Statut : Corbeille", tag: "mnemo.question.status.trash"));
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
                await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, _mnemoQuizStatusFilter).ConfigureAwait(true);
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

        if (action.StartsWith("mnemo.question.status.", StringComparison.OrdinalIgnoreCase))
        {
            var status = action["mnemo.question.status.".Length..];
            IsBusy = true;
            try
            {
                await _admin.UpdateMnemoQuizQuestionAsync(question.Id, status: status).ConfigureAwait(true);
                if (_selectedMnemoQuizCategory != null)
                {
                    await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, _mnemoQuizStatusFilter).ConfigureAwait(true);
                }
            }
            finally
            {
                IsBusy = false;
            }
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
                    await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, _mnemoQuizStatusFilter).ConfigureAwait(true);
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
        _page = AdminPage.EditText;
        Title = title;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "mnemo.edit.submit"));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = label;
        TextInput = initialValue;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        Details = string.Empty;
        Status = "Saisissez puis Entrée pour valider. Échap : retour.";
        _currentEditMode = mode;
        RestoreFocusIfAny();
    }

    private static bool TryParseMnemoQuestionBlock(string raw, out string question, out string[] answers)
    {
        var lines = (raw ?? string.Empty)
            .Split('\n')
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToArray();

        if (lines.Length < 5)
        {
            question = string.Empty;
            answers = Array.Empty<string>();
            return false;
        }

        question = lines[0];
        answers = new[] { lines[1], lines[2], lines[3], lines[4] };
        return !string.IsNullOrWhiteSpace(question) && answers.All(a => !string.IsNullOrWhiteSpace(a));
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
            if (!TryParseMnemoQuestionBlock(value, out var q, out var answers))
            {
                await _dialogs.ShowError("Quiz", "Format invalide. Attendu 5 lignes non vides.").ConfigureAwait(true);
                return;
            }
            IsBusy = true;
            try
            {
                await _admin.CreateMnemoQuizQuestionAsync(_selectedMnemoQuizCategory.Id, q, answers, correctIndex: 0, status: "pending").ConfigureAwait(true);
                await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, "pending").ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (mode == "mnemo.question.edit" && _selectedMnemoQuizCategory != null && _selectedMnemoQuizQuestion != null)
        {
            if (!TryParseMnemoQuestionBlock(value, out var q, out var answers))
            {
                await _dialogs.ShowError("Quiz", "Format invalide. Attendu 5 lignes non vides.").ConfigureAwait(true);
                return;
            }
            IsBusy = true;
            try
            {
                await _admin.UpdateMnemoQuizQuestionAsync(_selectedMnemoQuizQuestion.Id, question: q, answers: answers, correctIndex: 0).ConfigureAwait(true);
                await LoadMnemoQuizQuestionsAsync(_selectedMnemoQuizCategory.Id, _mnemoQuizStatusFilter).ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}

