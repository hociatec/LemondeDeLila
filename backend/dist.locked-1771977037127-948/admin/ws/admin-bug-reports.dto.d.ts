export declare class AdminBugReportCreateWsDto {
    subject: string;
    content: string;
}
export declare class AdminBugReportIdWsDto {
    id: string;
}
export declare class AdminBugReportsListWsDto {
    _noop?: string;
}
export declare class AdminBugReportUpdateWsDto extends AdminBugReportIdWsDto {
    subject?: string;
    content?: string;
}
export declare class AdminBugReportUpdateStatusWsDto extends AdminBugReportIdWsDto {
    status: 'pending' | 'in_progress' | 'to_test' | 'done' | 'refused' | 'rejected';
}
