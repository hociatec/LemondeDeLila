# Cartographie Pending (Phase 4.1)

Date de scan: 2026-02-18

## Types gameplay transverses (prioritaires)
- `draw`
- `choose_target`
- `choose_pawn`
- `choose_option`
- `choose_number`
- `choose_card`
- `choose_next_player`
- `choose_next_delta`
- `pick`
- `pick_choice`
- `quiz`
- `reroll`
- `swap`
- `swap_choose_target`
- `exchange`
- `exchange_pending`
- `merchant_request`
- `merchant_request_accept`
- `merchant_request_refuse`

## Types gameplay specifiques jeu
- `move_pawn`
- `buy`
- `skip_buy`
- `choose_property`
- `play_name`
- `play_special`
- `answer_quiz`
- `lama_play`
- `lama_return`

## Types admin / edition (Arche de Mnemosyne)
- `mnemo_set_config`
- `mnemo_start`
- `mnemo_back`
- `mnemo_open_questions`
- `mnemo_open_question`
- `mnemo_open_edit_question`
- `mnemo_open_add_question`
- `mnemo_open_rename_category`
- `mnemo_open_all_questions`
- `mnemo_set_question_status`
- `mnemo_delete_category`

## Notes
- Cette cartographie est derivee d'un scan statique des services/rulebooks.
- Les types de test-only (`info`, `symbol`, `finish`, etc.) ne sont pas inclus dans la cible de migration phase 4.
- Priorite de migration phase 4.2: `draw`, `choose_target`, `choose_pawn`, `quiz`, `exchange`, `pick`.
