import { CircleAlert } from "lucide-react";

export function FieldError({
  id,
  error,
}: {
  id: string;
  error: string | undefined;
}) {
  if (!error) return null;
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-sm text-destructive"
      role="alert"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  );
}
