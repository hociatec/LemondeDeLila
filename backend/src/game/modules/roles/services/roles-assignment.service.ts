import { Injectable } from '@nestjs/common';

@Injectable()
export class RolesAssignmentService {
  assign<T extends string>(
    playerIds: number[],
    prioritizedRoles: T[],
    defaultRole: T,
    rng: () => number = Math.random,
  ): Record<number, T> {
    const ids = [...playerIds].filter((id) => typeof id === 'number');
    this.shuffle(ids, rng);
    const roles: Record<number, T> = {};
    ids.forEach((id, idx) => {
      roles[id] = prioritizedRoles[idx] ?? defaultRole;
    });
    return roles;
  }

  private shuffle(array: number[], rng: () => number) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
