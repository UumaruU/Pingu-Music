import { FormEvent, useState } from "react";

interface LoginPageProps {
  isLoading: boolean;
  error: string | null;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onOpenRegister: () => void;
}

export function LoginPage({ isLoading, error, onLogin, onOpenRegister }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password.trim()) {
      setFormError("Введите email и пароль.");
      return;
    }

    setFormError(null);
    await onLogin({
      email: normalizedEmail,
      password,
    });
  };

  return (
    <section className="mx-auto w-full max-w-[560px] rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),linear-gradient(160deg,#0f1420,#0a0d12_62%,#0c1320)] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white">Вход в аккаунт</h1>
        <p className="mt-2 text-sm text-white/60">
          Войдите, чтобы синхронизировать избранное, плейлисты и настройки.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-white/45">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-cyan-300/35"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-white/45">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-cyan-300/35"
            placeholder="••••••••"
          />
        </label>

        {formError ? (
          <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {formError}
          </div>
        ) : null}

        {!formError && error ? (
          <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isLoading ? "Входим..." : "Войти"}
        </button>
      </form>

      <div className="mt-5 text-sm text-white/60">
        Нет аккаунта?{" "}
        <button
          type="button"
          onClick={onOpenRegister}
          className="font-medium text-cyan-200 transition hover:text-cyan-100"
        >
          Зарегистрироваться
        </button>
      </div>
    </section>
  );
}

