import { z } from 'zod';

export function pagerSchema(maxLimit = 50) {
  const defaultLimit = Math.ceil(maxLimit / 2);
  return z.object({
    limit: z.coerce.number().max(maxLimit).min(1).default(defaultLimit),
    offset: z.coerce.number().min(0).default(0),
  });
}

export function unlimitedPagerSchema() {
  const limit = Number.MAX_SAFE_INTEGER;
  return z.object({
    limit: z.coerce.number().min(1).max(limit).default(limit),
    offset: z.coerce.number().min(0).default(0),
  });
}

export interface PageDto<T> {
  data: T[];
  total: number;
  offset: number;
  count: number;
}

export function mapPage<T>(
  controls: { limit: number; offset: number },
  items: T[],
  total: number,
): PageDto<T> {
  return {
    data: items,
    count: items.length,
    offset: controls.offset,
    total,
  };
}
