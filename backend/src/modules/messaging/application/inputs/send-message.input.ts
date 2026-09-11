/** Validated application input for sending a private message. */
export type SendMessageInput = {
  recipientId: number;
  text: string;
  subject?: string;
};
