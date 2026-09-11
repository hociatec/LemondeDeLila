import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import { GameTaskDispatchService } from './game-task-dispatch.service';

it('keeps queued cancellation in the drain even when the preceding schedule fails', async () => {
  const shutdown = new ApplicationShutdownService();
  let rejectSchedule!: (error: Error) => void;
  const scheduling = new Promise<void>((_resolve, reject) => {
    rejectSchedule = reject;
  });
  const scheduler = {
    schedule: jest.fn(() => scheduling),
    cancel: jest.fn(async () => undefined),
    cancelRoom: jest.fn(async () => undefined),
    registerProcessor: jest.fn(),
  };
  const dispatch = new GameTaskDispatchService(scheduler, shutdown);
  dispatch.schedule({
    key: 'room:1',
    roomId: 1,
    gameType: 'example',
    generation: 1,
    signature: 'turn:1',
    dueAtMs: 1,
  });
  dispatch.cancel('room:1', 'example');
  shutdown.stopAccepting();
  const drained = shutdown.drain();
  expect(scheduler.cancel).not.toHaveBeenCalled();
  rejectSchedule(new Error('scheduler temporarily unavailable'));
  await drained;
  expect(scheduler.cancel).toHaveBeenCalledWith('room:1');
});
