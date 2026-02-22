import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { MnemoQuizStoreService } from '../../game/games/vents-infinis/arche-de-mnemosyne/store/mnemo-quiz-store.service';
import type { MnemoQuestionStatus } from '../../game/games/vents-infinis/arche-de-mnemosyne/model/mnemo-quiz.model';
export declare class AdminMnemoQuizWsHandler {
    private readonly validator;
    private readonly store;
    constructor(validator: PayloadValidationService, store: MnemoQuizStoreService);
    private normalizeStatus;
    private buildCategoriesPayload;
    private buildQuestionsPayload;
    mnemoCategories(session: WsSession, payload: any): {
        type: string;
        payload: {
            categories: {
                id: string;
                name: string;
            }[];
        };
    };
    mnemoCategoryCreate(session: WsSession, payload: any): {
        type: string;
        payload: {
            categories: {
                id: string;
                name: string;
            }[];
        };
    };
    mnemoCategoryUpdate(session: WsSession, payload: any): {
        type: string;
        payload: {
            categories: {
                id: string;
                name: string;
            }[];
        };
    };
    mnemoCategoryDelete(session: WsSession, payload: any): {
        type: string;
        payload: {
            categories: {
                id: string;
                name: string;
            }[];
        };
    };
    mnemoQuestions(session: WsSession, payload: any): {
        type: string;
        payload: {
            questions: {
                id: string;
                categoryId: string;
                question: string;
                status: MnemoQuestionStatus;
                createdAt: string;
                updatedAt: string;
                answers: string[];
                correctIndex: number;
            }[];
        };
    };
    mnemoQuestionCreate(session: WsSession, payload: any): {
        type: string;
        payload: {
            questions: {
                id: string;
                categoryId: string;
                question: string;
                status: MnemoQuestionStatus;
                createdAt: string;
                updatedAt: string;
                answers: string[];
                correctIndex: number;
            }[];
        };
    };
    mnemoQuestionUpdate(session: WsSession, payload: any): {
        type: string;
        payload: {
            questions: {
                id: string;
                categoryId: string;
                question: string;
                status: MnemoQuestionStatus;
                createdAt: string;
                updatedAt: string;
                answers: string[];
                correctIndex: number;
            }[];
        };
    };
    mnemoQuestionDelete(session: WsSession, payload: any): {
        type: string;
        payload: {
            questions: {
                id: string;
                categoryId: string;
                question: string;
                status: MnemoQuestionStatus;
                createdAt: string;
                updatedAt: string;
                answers: string[];
                correctIndex: number;
            }[];
        };
    };
}
