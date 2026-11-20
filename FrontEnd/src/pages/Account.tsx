import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, useApi } from "../api/client";
import type { ChapterSummary, ProgressSummary } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, PageHeader, pct, ProgressBar, Segmented, Spinner } from "../components/ui";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/prehled" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      navigate("/prehled");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent";
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={mode === "login" ? "Přihlášení" : "Registrace"} />
      <Card>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "login", label: "Mám účet" },
            { value: "register", label: "Nový účet" },
          ]}
        />
        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "register" && (
            <label className="block text-sm">
              Jméno nebo přezdívka
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="nickname" />
            </label>
          )}
          <label className="block text-sm">
            E-mail
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="block text-sm">
            Heslo {mode === "register" && <span className="text-muted">(alespoň 8 znaků)</span>}
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && <p className="rounded-lg bg-bad-soft p-2 text-sm text-bad">{error}</p>}
          <Button variant="primary" type="submit" className="w-full" disabled={busy}>
            {mode === "login" ? "Přihlásit" : "Vytvořit účet"}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted">
          Ukládáme jen e-mail, jméno, hash hesla a tvůj studijní pokrok. Účet i se všemi daty můžeš kdykoli smazat v profilu.
        </p>
      </Card>
    </div>
  );
}

export function ProfilePage() {
  const { user, ready, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const progress = useApi<ProgressSummary>(user ? "/progress/summary" : null, { deps: [user?.id] });
  const chapters = useApi<ChapterSummary[]>("/chapters", { cache: true });

  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/prihlaseni" replace />;

  const title = (id: string) => chapters.data?.find((c) => c.id === id);

  async function reset(chapterId?: string) {
    if (!window.confirm(chapterId ? "Smazat pokrok v této kapitole?" : "Opravdu smazat veškerý pokrok? Tuto akci nelze vrátit.")) return;
    await api(`/progress${chapterId ? `?chapter_id=${chapterId}` : ""}`, { method: "DELETE" });
    progress.reload();
  }

  async function remove() {
    if (!window.confirm("Opravdu smazat účet i se všemi daty? Tuto akci nelze vrátit.")) return;
    await deleteAccount();
    navigate("/");
  }

  return (
    <div>
      <PageHeader title={user.display_name} subtitle={user.email}>
        <Button onClick={logout}>Odhlásit</Button>
      </PageHeader>
      {progress.loading && <Spinner />}
      {progress.data && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="text-3xl font-bold">{progress.data.total_reviews}</div>
              <div className="text-sm text-muted">zopakovaných kartiček</div>
            </Card>
            <Card>
              <div className="text-3xl font-bold">{progress.data.streak_days}</div>
              <div className="text-sm text-muted">dní v řadě</div>
            </Card>
            <Card>
              <div className="text-3xl font-bold">
                {pct(progress.data.chapters.reduce((a, c) => a + c.mastery, 0) / Math.max(1, progress.data.chapters.length))}
              </div>
              <div className="text-sm text-muted">celkem zvládnuto</div>
            </Card>
          </div>
          <Card className="mb-6 overflow-x-auto">
            <h2 className="mb-3 font-semibold">Úspěšnost podle kapitol</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1">Kapitola</th>
                  <th className="w-40">Zvládnuto</th>
                  <th>Kartičky</th>
                  <th>Kvíz</th>
                  <th>Příklady</th>
                  <th>Důkazy</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {progress.data.chapters.map((c) => (
                  <tr key={c.chapter_id} className="border-t border-line">
                    <td className="py-2 pr-2">
                      {title(c.chapter_id)?.number}. {title(c.chapter_id)?.title ?? c.chapter_id}
                    </td>
                    <td className="pr-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={c.mastery} />
                        <span className="w-10 text-right tabular-nums">{pct(c.mastery)}</span>
                      </div>
                    </td>
                    <td className="tabular-nums">
                      {c.cards_learned}/{c.cards_total}
                      {c.cards_due > 0 && <span className="ml-1 text-warn">({c.cards_due} k opak.)</span>}
                    </td>
                    <td className="tabular-nums">{pct(c.quiz_accuracy)}</td>
                    <td className="tabular-nums">{c.exercise_attempts ? pct(c.exercise_accuracy) : "–"}</td>
                    <td className="tabular-nums">{c.proof_attempts ? pct(c.proof_accuracy) : "–"}</td>
                    <td>
                      <button className="text-xs text-muted hover:text-bad" onClick={() => reset(c.chapter_id)}>
                        reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              „Zvládnuto“ je vážený průměr: kartičky 40 %, kvíz 30 %, příklady 20 %, důkazy 10 % (u kapitol bez dané složky se váha přepočítá).
            </p>
          </Card>
        </>
      )}
      <Card>
        <h2 className="mb-2 font-semibold">Správa dat</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => reset()}>Smazat veškerý pokrok</Button>
          <Button variant="bad" onClick={remove}>
            Smazat účet
          </Button>
        </div>
      </Card>
    </div>
  );
}
