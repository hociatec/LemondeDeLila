export const MESSAGE_CONTACT_POLICY = Symbol('MESSAGE_CONTACT_POLICY');
export interface MessageContactPolicy {
  canSend(senderId: number, recipientId: number): Promise<boolean>;
}
