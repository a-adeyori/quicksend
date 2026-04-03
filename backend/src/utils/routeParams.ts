import { AppError } from '../middleware/errorHandler';

/** Express `req.params` values are typed as `string | string[]` in strict mode. */
export function requireRouteParam(param: string | string[] | undefined, name = 'id'): string {
  const s = Array.isArray(param) ? param[0] : param;
  if (s === undefined || s === '') {
    throw AppError.badRequest(`Missing ${name}`);
  }
  return s;
}
