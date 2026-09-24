import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type { PlayerValuesKitState } from './player-values-contracts';
import {
  assertGameValue,
  assertGamePlayerId,
  assertPlayerValueId,
} from './numeric-invariants';
import { prepareResourceExchange } from './resource-exchange';
import { quoteResourcePayment } from './resource-payment';
import type { ResourceDefinition } from '../contracts/resource-definition';
import { assertResourceBounds, resources } from './resource-definition';
import type {
  InsufficientResourcePolicy,
  ResourcePayment,
} from '../contracts/resource-payment';

export class GameResourcesController<TResourceId extends string = string> {
  private readonly definitions = new Map<string, ResourceDefinition>();
  constructor(
    private readonly state: PlayerValuesKitState<TResourceId>,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
    definitions: readonly ResourceDefinition[] = [],
  ) {
    for (const definition of definitions)
      this.definitions.set(definition.id, resources.pool(definition));
  }

  initialize(
    definition: ResourceDefinition<TResourceId>,
    playerIds: readonly number[],
  ): void {
    const validated = resources.pool(definition);
    for (const playerId of playerIds) {
      assertGamePlayerId(playerId);
      assertGameValue(
        (definition.initial ?? 0) - this.get(playerId, definition.id),
      );
    }
    this.definitions.set(definition.id, validated);
    for (const playerId of playerIds)
      this.set(playerId, definition.id, definition.initial ?? 0);
  }

  get(playerId: number, resource: TResourceId): number {
    assertGamePlayerId(playerId);
    assertPlayerValueId(resource);
    return this.state.resources[resource]?.[String(playerId)] ?? 0;
  }

  set(playerId: number, resource: TResourceId, value: number): number {
    const previous = this.get(playerId, resource);
    assertGameValue(value);
    assertGameValue(previous);
    assertGameValue(value - previous);
    assertResourceBounds(this.definitions.get(resource), value);
    const stateResources = this.state.resources as Record<
      string,
      Record<string, number>
    >;
    (stateResources[resource] ??= {})[String(playerId)] = value;
    this.emit('resource.changed', {
      playerId,
      resource,
      previous,
      value,
      delta: value - previous,
    });
    return value;
  }

  add(playerId: number, resource: TResourceId, amount: number): number {
    return this.set(playerId, resource, this.get(playerId, resource) + amount);
  }

  has(playerId: number, resource: TResourceId, amount: number): boolean {
    return this.quote(playerId, resource, amount).accepted;
  }

  remove(playerId: number, resource: TResourceId, amount: number): number {
    const payment = this.quote(playerId, resource, amount);
    if (!payment.accepted) {
      throw new GameRuleViolationError(
        'RESOURCE_INSUFFICIENT',
        { playerId, resource, amount, available: this.get(playerId, resource) },
        `Ressource insuffisante: ${resource}`,
      );
    }
    return this.set(playerId, resource, payment.balance);
  }

  quote(
    playerId: number,
    resource: TResourceId,
    amount: number,
    policy: InsufficientResourcePolicy = 'cancel',
  ): ResourcePayment {
    const definition = this.definitions.get(resource);
    const minimum = definition?.min ?? 0;
    const payment = quoteResourcePayment(
      this.get(playerId, resource) - minimum,
      amount,
      policy,
    );
    const result = { ...payment, balance: payment.balance + minimum };
    if (result.accepted) assertResourceBounds(definition, result.balance);
    return result;
  }

  settle(
    playerId: number,
    resource: TResourceId,
    amount: number,
    policy: InsufficientResourcePolicy = 'cancel',
  ): ResourcePayment {
    const payment = this.quote(playerId, resource, amount, policy);
    if (payment.accepted && payment.paid > 0)
      this.set(playerId, resource, payment.balance);
    return payment;
  }

  transfer(
    from: number,
    to: number,
    resource: TResourceId,
    amount: number,
  ): void {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    assertGamePlayerId(from);
    assertGamePlayerId(to);
    assertPlayerValueId(resource);
    if (from === to) return;
    const fromKey = String(from);
    const toKey = String(to);
    const stateResources = this.state.resources as Record<
      string,
      Record<string, number>
    >;
    const resources = stateResources[resource] ?? {};
    const sourceAmount = resources[fromKey] ?? 0;
    const payment = this.quote(from, resource, normalizedAmount);
    if (!payment.accepted) {
      throw new GameRuleViolationError(
        'RESOURCE_INSUFFICIENT',
        { from, to, resource, amount, available: sourceAmount },
        'Ressource insuffisante',
      );
    }
    const destinationAmount = resources[toKey] ?? 0;
    assertGameValue(sourceAmount);
    assertGameValue(destinationAmount);
    assertGameValue(destinationAmount + normalizedAmount);
    assertResourceBounds(
      this.definitions.get(resource),
      sourceAmount - normalizedAmount,
    );
    assertResourceBounds(
      this.definitions.get(resource),
      destinationAmount + normalizedAmount,
    );
    stateResources[resource] = resources;
    resources[fromKey] = payment.balance;
    resources[toKey] = destinationAmount + normalizedAmount;
    this.emit('resource.changed', {
      playerId: from,
      resource,
      previous: sourceAmount,
      value: resources[fromKey],
      delta: -normalizedAmount,
    });
    this.emit('resource.changed', {
      playerId: to,
      resource,
      previous: destinationAmount,
      value: resources[toKey],
      delta: normalizedAmount,
    });
    this.emit('resource.transferred', {
      from,
      to,
      resource,
      amount: normalizedAmount,
    });
  }

  exchange(
    leftPlayerId: number,
    rightPlayerId: number,
    left: { resource: TResourceId; amount: number },
    right: { resource: TResourceId; amount: number },
  ): void {
    const changes = prepareResourceExchange(
      this.state.resources,
      leftPlayerId,
      rightPlayerId,
      left,
      right,
    );
    const resources: Record<string, Record<string, number>> = this.state
      .resources;
    for (const change of changes)
      assertResourceBounds(this.definitions.get(change.resource), change.value);
    for (const change of changes)
      (resources[change.resource] ??= {})[String(change.playerId)] =
        change.value;
    for (const change of changes)
      this.emit('resource.changed', {
        ...change,
        delta: change.value - change.previous,
      });
    if (changes.length > 0)
      this.emit('resource.exchanged', {
        leftPlayerId,
        rightPlayerId,
        left: { ...left },
        right: { ...right },
      });
  }

  private normalizePositiveAmount(amount: number): number {
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new GameRuleViolationError(
        'RESOURCE_TRANSFER_AMOUNT',
        { amount },
        "Quantité d'échange invalide",
      );
    }
    return amount;
  }
}
