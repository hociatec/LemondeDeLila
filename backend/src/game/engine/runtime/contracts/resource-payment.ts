export type InsufficientResourcePolicy =
  'cancel' | 'debt' | 'partial' | 'eliminate';
export type ResourcePayment = {
  accepted: boolean;
  paid: number;
  shortfall: number;
  balance: number;
  eliminate: boolean;
};
