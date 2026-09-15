import { loginAction } from "@/lib/actions";
import { LoginSubmitButton } from "@/components/LoginSubmitButton";
import { getBrandingSettings } from "@/lib/data";
import { LOGIN_WINDOW_SECONDS } from "@/lib/rateLimit";

export default async function LoginPage({
  searchParams,
}) {
  const params = await searchParams;
  const next = params.next ?? "/calendar";
  const { appTitle } = await getBrandingSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-md border border-paper-line bg-background p-6 shadow-[var(--shadow-resting)]"
      >
        <input type="hidden" name="next" value={next} />
        <h1 className="text-xl font-bold tracking-tight text-brand-ink">{appTitle}</h1>
        <p className="mt-1 text-sm text-brand-ink/75">Enter the passcode to continue.</p>

        <input
          type="password"
          name="passcode"
          autoFocus
          required
          aria-label="Passcode"
          placeholder="Passcode"
          className="mt-4 w-full rounded-sm border border-brand-ink/20 bg-background px-3 py-2 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/30 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
        />

        {params.error && (
          <p className="mt-2 text-sm text-red-600">
            {params.error === "locked"
              ? `Too many incorrect attempts. Wait ${Math.round(LOGIN_WINDOW_SECONDS / 60)} minutes and try again.`
              : "Incorrect passcode. Try again."}
          </p>
        )}

        <LoginSubmitButton />
      </form>
    </div>
  );
}
