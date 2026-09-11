export const STAFF_USERS_READER = Symbol('STAFF_USERS_READER');
export interface StaffUsersReader {
  listStaff(): Promise<readonly { id: number }[]>;
}
