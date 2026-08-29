import { AdminProfileService } from './admin-profile.service';

describe('AdminProfileService', () => {
  it('delegates profile settings update', async () => {
    const settings = {
      get: jest.fn(),
      update: jest.fn(async () => ({
        bioMinLength: 10,
        bioMaxLength: 200,
      })),
    };
    const service = new AdminProfileService(settings as any);

    const result = await service.updateSettings({
      bioMinLength: 10,
      bioMaxLength: 200,
    });

    expect(settings.update).toHaveBeenCalledWith({
      bioMinLength: 10,
      bioMaxLength: 200,
    });
    expect(result).toEqual({
      bioMinLength: 10,
      bioMaxLength: 200,
    });
  });
});
