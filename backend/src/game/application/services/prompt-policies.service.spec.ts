import { PromptPoliciesService } from './prompt-policies.service';

describe('PromptPoliciesService', () => {
  it('does not append duplicate prompt logs', () => {
    const core = {
      appendLog: jest.fn((state, message) => ({
        ...state,
        log: [...(state.log ?? []), { message }],
      })),
    } as any;
    const service = new PromptPoliciesService(core);
    const state: any = { log: [{ message: 'hello' }] };

    expect(service.appendLogOnce(state, 'hello')).toBe(state);
    expect(core.appendLog).not.toHaveBeenCalled();
  });
});
