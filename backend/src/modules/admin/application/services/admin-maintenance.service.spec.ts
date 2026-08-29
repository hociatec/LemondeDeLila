import { InternalServerErrorException } from '@nestjs/common';
import { AdminDaemonReloadService } from '../use-cases/admin-maintenance/admin-daemon-reload.service';
import { GetAdminBackendServiceStatusService } from '../use-cases/admin-maintenance/get-admin-backend-service-status.service';
import { StartAdminDeployService } from '../use-cases/admin-maintenance/start-admin-deploy.service';
import type { AdminMaintenanceConfig } from '../ports/admin-maintenance-config.port';

describe('Admin maintenance use-cases', () => {
  it('uses runtime port to start deploy', () => {
    const runtime = createRuntime();
    runtime.runCommand.mockReturnValue({
      status: 0,
      stdout: '',
      stderr: '',
      error: null,
    });
    const config = createConfig();

    const service = new StartAdminDeployService(runtime as any, config);

    expect(service.execute()).toEqual({
      ok: true,
      unit: config.deployUnit,
    });
    expect(runtime.runCommand).toHaveBeenCalledWith([
      'sudo',
      '-n',
      'systemctl',
      'start',
      '--no-block',
      config.deployUnit,
    ]);
  });

  it('parses status through the runtime port', () => {
    const runtime = createRuntime();
    runtime.runCommand.mockReturnValue({
      status: 0,
      stdout: 'Id=svc\nActiveState=active',
      stderr: '',
      error: null,
    });
    runtime.parseSystemctlShow.mockReturnValue({
      Id: 'svc',
      ActiveState: 'active',
    });
    const config = createConfig();

    const service = new GetAdminBackendServiceStatusService(
      runtime as any,
      config,
    );

    expect(service.execute()).toEqual({
      ok: true,
      unit: config.backendService,
      Id: 'svc',
      ActiveState: 'active',
    });
    expect(runtime.parseSystemctlShow).toHaveBeenCalledWith(
      'Id=svc\nActiveState=active',
    );
  });

  it('throws when runtime command fails', () => {
    const runtime = createRuntime();
    runtime.runCommand.mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'boom',
      error: null,
    });

    const service = new AdminDaemonReloadService(runtime as any);

    expect(() => service.execute()).toThrow(InternalServerErrorException);
  });
});

function createRuntime() {
  return {
    runCommand: jest.fn(),
    spawnDetached: jest.fn(),
    httpGet: jest.fn(),
    parseSystemctlShow: jest.fn(),
    parseTail: jest.fn(),
    shQuote: jest.fn(),
  };
}

function createConfig(): AdminMaintenanceConfig {
  return {
    deployUnit: 'lila-backend-deploy.service',
    backendService: 'lila-backend.service',
    healthPort: 3000,
  };
}
