export type SocialUserSummary = {
  id: number;
  username: string;
  avatar: string | null;
};

export type SocialSearchUserSummary = SocialUserSummary & {
  profileVisibility: 'public' | 'friends' | 'private';
};
