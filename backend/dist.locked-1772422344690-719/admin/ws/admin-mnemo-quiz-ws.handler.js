"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminMnemoQuizWsHandler", {
    enumerable: true,
    get: function() {
        return AdminMnemoQuizWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _mnemoquizstoreservice = require("../../game/games/vents-infinis/arche-de-mnemosyne/store/mnemo-quiz-store.service");
const _adminmnemoquizdto = require("./admin-mnemo-quiz.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminMnemoQuizWsHandler = class AdminMnemoQuizWsHandler {
    normalizeStatus(value) {
        if (typeof value !== 'string') {
            return undefined;
        }
        const raw = value.trim().toLowerCase();
        if (raw === 'validated') return 'validated';
        if (raw === 'to_edit') return 'to_edit';
        if (raw === 'trash') return 'trash';
        if (raw === 'pending') return 'pending';
        return undefined;
    }
    buildCategoriesPayload() {
        const categories = this.store.listCategories().map((c)=>({
                id: c.id,
                name: c.name
            }));
        return {
            categories
        };
    }
    buildQuestionsPayload(filter) {
        const questions = this.store.listQuestions(filter).map((q)=>({
                id: q.id,
                categoryId: q.categoryId,
                question: q.question,
                status: q.status,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt,
                answers: [
                    q.correct,
                    q.wrong1,
                    q.wrong2,
                    q.wrong3
                ],
                correctIndex: 0
            }));
        return {
            questions
        };
    }
    mnemoCategories(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizCategoriesListWsDto, payload ?? {});
        return {
            type: 'admin.quiz.mnemo.categories',
            payload: this.buildCategoriesPayload()
        };
    }
    mnemoCategoryCreate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizCategoryCreateWsDto, payload);
        this.store.createCategory(dto.name);
        return {
            type: 'admin.quiz.mnemo.categories',
            payload: this.buildCategoriesPayload()
        };
    }
    mnemoCategoryUpdate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizCategoryUpdateWsDto, payload);
        this.store.renameCategory(dto.id, dto.name);
        return {
            type: 'admin.quiz.mnemo.categories',
            payload: this.buildCategoriesPayload()
        };
    }
    mnemoCategoryDelete(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizCategoryDeleteWsDto, payload);
        this.store.deleteCategory(dto.id);
        return {
            type: 'admin.quiz.mnemo.categories',
            payload: this.buildCategoriesPayload()
        };
    }
    mnemoQuestions(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizQuestionsListWsDto, payload ?? {});
        return {
            type: 'admin.quiz.mnemo.questions',
            payload: this.buildQuestionsPayload({
                categoryId: dto.categoryId?.trim() || undefined,
                status: this.normalizeStatus(dto.status)
            })
        };
    }
    mnemoQuestionCreate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizQuestionCreateWsDto, payload);
        const answers = (dto.answers ?? []).map((a)=>String(a ?? '').trim());
        const correctIndex = Number(dto.correctIndex);
        const correct = answers[correctIndex] ?? '';
        const wrong = answers.filter((_, idx)=>idx !== correctIndex);
        this.store.createQuestion({
            categoryId: dto.categoryId,
            question: dto.question,
            correct,
            wrong1: wrong[0] ?? '',
            wrong2: wrong[1] ?? '',
            wrong3: wrong[2] ?? '',
            status: this.normalizeStatus(dto.status) ?? 'validated'
        });
        return {
            type: 'admin.quiz.mnemo.questions',
            payload: this.buildQuestionsPayload()
        };
    }
    mnemoQuestionUpdate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizQuestionUpdateWsDto, payload);
        if (dto.categoryId) {
            // Catégorie: on fait une update via patch direct sur l'objet (store actuel ne supporte pas le move).
            // On le gère en 2 étapes: lecture + update partielle.
            const existing = this.store.listQuestions().find((q)=>q.id === dto.id);
            if (!existing) {
                throw new Error('Question introuvable');
            }
            existing.categoryId = String(dto.categoryId).trim();
            existing.updatedAt = new Date().toISOString();
            // persist via updateQuestion (noop sur champs) pour déclencher validations + persist
            this.store.updateQuestion(dto.id, {});
        }
        const patch = {};
        if (dto.question !== undefined) patch.question = dto.question;
        if (dto.status !== undefined) patch.status = this.normalizeStatus(dto.status);
        if (dto.answers !== undefined || dto.correctIndex !== undefined) {
            const existing = this.store.listQuestions().find((q)=>q.id === dto.id);
            if (!existing) {
                throw new Error('Question introuvable');
            }
            const baseAnswers = dto.answers ? dto.answers.map((a)=>String(a ?? '').trim()) : [
                existing.correct,
                existing.wrong1,
                existing.wrong2,
                existing.wrong3
            ].map((x)=>String(x ?? '').trim());
            const correctIndex = dto.correctIndex != null ? Number(dto.correctIndex) : 0;
            const correct = baseAnswers[correctIndex] ?? '';
            const wrong = baseAnswers.filter((_, idx)=>idx !== correctIndex);
            patch.correct = correct;
            patch.wrong1 = wrong[0] ?? '';
            patch.wrong2 = wrong[1] ?? '';
            patch.wrong3 = wrong[2] ?? '';
        }
        this.store.updateQuestion(dto.id, patch);
        return {
            type: 'admin.quiz.mnemo.questions',
            payload: this.buildQuestionsPayload()
        };
    }
    mnemoQuestionDelete(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminmnemoquizdto.AdminMnemoQuizQuestionDeleteWsDto, payload);
        this.store.deleteQuestion(dto.id);
        return {
            type: 'admin.quiz.mnemo.questions',
            payload: this.buildQuestionsPayload()
        };
    }
    constructor(validator, store){
        this.validator = validator;
        this.store = store;
    }
};
AdminMnemoQuizWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _mnemoquizstoreservice.MnemoQuizStoreService === "undefined" ? Object : _mnemoquizstoreservice.MnemoQuizStoreService
    ])
], AdminMnemoQuizWsHandler);
