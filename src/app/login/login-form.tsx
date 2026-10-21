"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/i18n/client";
import { loginAction, type LoginState } from "@/server/auth/actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );
  const errorId = state.error ? "login-error" : undefined;
  const { t } = useI18n();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <Alert variant="destructive" id="login-error" role="alert">
          <CircleAlert aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">{t.login.username}</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={128}
          defaultValue={state.username}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={errorId}
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t.login.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={errorId}
          className="h-11"
        />
      </div>

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> {t.login.submitting}
          </>
        ) : (
          t.login.submit
        )}
      </Button>
    </form>
  );
}
