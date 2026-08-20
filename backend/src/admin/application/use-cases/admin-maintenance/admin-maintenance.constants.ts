export const ADMIN_DEPLOY_UNIT =
  process.env.ADMIN_MAINTENANCE_DEPLOY_UNIT || 'lila-backend-deploy.service';

export const ADMIN_BACKEND_SERVICE =
  process.env.ADMIN_MAINTENANCE_BACKEND_SERVICE || 'lila-backend.service';

export const ADMIN_SERVICE_RE = /^[a-zA-Z0-9@._-]+$/;
