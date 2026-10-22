import { code } from "@/i18n/codes";

import { type ParseResult, parsed, rejected } from "./parse-result";

/*
 * HTTP basic auth of a managed site: one user per site, stored as user name
 * plus bcrypt hash (Caddy's `basic_auth` default algorithm), never the
 * password. No dependencies: also used by the editor in the browser.
 */

export const BASIC_AUTH_USERNAME_MAX_LENGTH = 64;
export const BASIC_AUTH_PASSWORD_MIN_LENGTH = 12;
/** bcrypt only uses the first 72 bytes; longer passwords are rejected, not cut. */
export const BASIC_AUTH_PASSWORD_MAX_BYTES = 72;

/** One bare Caddyfile token without `:` (the user/password separator of the header). */
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** Modular crypt format of bcrypt: `$2b$12$` + 22 characters salt + 31 characters hash. */
export const BCRYPT_HASH =
  /^\$2[aby]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

export function parseBasicAuthUsername(input: string): ParseResult<string> {
  const value = input.trim();
  if (value === "") return rejected(code("basicAuth.usernameRequired"));
  if (value.length > BASIC_AUTH_USERNAME_MAX_LENGTH) {
    return rejected(
      code("basicAuth.usernameTooLong", {
        max: BASIC_AUTH_USERNAME_MAX_LENGTH,
      }),
    );
  }
  if (!USERNAME.test(value)) return rejected(code("basicAuth.usernameChars"));
  return parsed(value);
}

/** Checks a new password; the value is never part of the message. */
export function checkBasicAuthPassword(password: string): ParseResult<string> {
  if (password === "") return rejected(code("basicAuth.passwordRequired"));
  if ([...password].length < BASIC_AUTH_PASSWORD_MIN_LENGTH) {
    return rejected(
      code("basicAuth.passwordTooShort", {
        min: BASIC_AUTH_PASSWORD_MIN_LENGTH,
      }),
    );
  }
  if (
    new TextEncoder().encode(password).length > BASIC_AUTH_PASSWORD_MAX_BYTES
  ) {
    return rejected(
      code("basicAuth.passwordTooLong", { max: BASIC_AUTH_PASSWORD_MAX_BYTES }),
    );
  }
  if (/[\x00-\x1f\x7f]/.test(password)) {
    return rejected(code("basicAuth.passwordChars"));
  }
  return parsed(password);
}

const GENERATED_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 20 random characters (about 116 bits), via Web Crypto; no look-alike characters. */
export function generateBasicAuthPassword(length = 20): string {
  // Rejection sampling: no modulo bias.
  const limit = 256 - (256 % GENERATED_ALPHABET.length);
  let password = "";
  while (password.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && password.length < length) {
        password += GENERATED_ALPHABET[byte % GENERATED_ALPHABET.length];
      }
    }
  }
  return password;
}

export function isBcryptHash(value: string): boolean {
  return BCRYPT_HASH.test(value);
}

/** Hides every bcrypt hash, e.g. in the preview of `sites.caddy`. */
export function redactBcryptHashes(text: string): string {
  return text.replace(
    new RegExp(BCRYPT_HASH.source.slice(1, -1), "g"),
    "********",
  );
}
