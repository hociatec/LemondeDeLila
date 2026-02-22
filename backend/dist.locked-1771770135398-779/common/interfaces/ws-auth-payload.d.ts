export interface WsAuthPayload {
    id: number;
    username: string;
    email?: string;
    roles?: string[];
}
