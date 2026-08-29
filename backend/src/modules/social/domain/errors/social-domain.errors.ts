export class SocialDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class SocialProfileUserRelationMissingError extends SocialDomainError {
  constructor(message: string) {
    super('SOCIAL_PROFILE_USER_RELATION_MISSING', message);
  }
}

export class SocialRelationshipUserRelationMissingError extends SocialDomainError {
  constructor(message: string) {
    super('SOCIAL_RELATIONSHIP_USER_RELATION_MISSING', message);
  }
}
