export declare class AdminMnemoQuizCategoriesListWsDto {
    _noop?: string;
}
export declare class AdminMnemoQuizCategoryCreateWsDto {
    name: string;
}
export declare class AdminMnemoQuizCategoryUpdateWsDto {
    id: string;
    name: string;
}
export declare class AdminMnemoQuizCategoryDeleteWsDto {
    id: string;
}
export declare class AdminMnemoQuizQuestionsListWsDto {
    categoryId?: string;
    status?: 'validated' | 'pending' | 'to_edit' | 'trash';
}
export declare class AdminMnemoQuizQuestionCreateWsDto {
    categoryId: string;
    question: string;
    answers: string[];
    correctIndex: number;
    status?: 'validated' | 'pending' | 'to_edit' | 'trash';
}
export declare class AdminMnemoQuizQuestionUpdateWsDto {
    id: string;
    categoryId?: string;
    question?: string;
    answers?: string[];
    correctIndex?: number;
    status?: 'validated' | 'pending' | 'to_edit' | 'trash';
}
export declare class AdminMnemoQuizQuestionDeleteWsDto {
    id: string;
}
