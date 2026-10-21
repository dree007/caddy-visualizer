export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; message: string };

export const parsed = <T>(value: T): ParseResult<T> => ({ ok: true, value });

export const rejected = (message: string): ParseResult<never> => ({
  ok: false,
  message,
});
