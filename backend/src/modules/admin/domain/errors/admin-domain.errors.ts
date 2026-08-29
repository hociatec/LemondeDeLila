export class AdminDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class AdminRoleAlreadyExistsError extends AdminDomainError {
  constructor(roleName: string) {
    super(`Le role '${roleName}' existe deja.`);
  }
}

export class AdminRoleNotFoundError extends AdminDomainError {
  constructor(roleName: string) {
    super(`Role '${roleName}' introuvable.`);
  }
}

export class AdminMnemoQuestionNotFoundError extends AdminDomainError {
  constructor() {
    super('Question introuvable');
  }
}
