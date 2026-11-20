import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/prehled", label: "Přehled" },
  { to: "/slovnik", label: "Slovník" },
  { to: "/kapitoly", label: "Kapitoly" },
  { to: "/opakovani", label: "Opakování" },
  { to: "/priklady", label: "Příklady" },
  { to: "/vizualizace", label: "Vizualizace" },
  { to: "/zkouska", label: "Ústní zkouška" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) navigate(`/slovnik?q=${encodeURIComponent(q.trim())}`);
    setQ("");
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `relative px-2.5 py-2 text-[0.95rem] font-semibold transition ${
      isActive
        ? "text-accent after:absolute after:inset-x-2.5 after:-bottom-px after:h-[3px] after:rounded-full after:bg-accent"
        : "text-muted hover:text-ink"
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2 py-2.5" aria-label="TGD1 – úvodní stránka">
            <Logo />
            <span className="font-display text-lg leading-none font-bold tracking-tight">
              TGD1<span className="text-muted">.grafy</span>
            </span>
          </Link>
          <nav className="ml-2 hidden items-center xl:flex" aria-label="Hlavní navigace">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkCls}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <form onSubmit={submit} className="ml-auto min-w-0 flex-1 xl:max-w-52" role="search">
            <input
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat pojem…"
              aria-label="Hledat pojem"
              className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </form>
          <div className="hidden items-center gap-3 xl:flex">
            <ThemeToggle />
            {user ? (
              <>
                <NavLink to="/profil" className={linkCls}>
                  {user.display_name}
                </NavLink>
                <button onClick={logout} className="text-sm text-muted hover:text-ink">
                  Odhlásit
                </button>
              </>
            ) : (
              <NavLink to="/prihlaseni" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
                Přihlásit
              </NavLink>
            )}
          </div>
          <button
            className="rounded-md border border-line px-2.5 py-1.5 text-sm font-semibold xl:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            Menu
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" className="border-t border-line bg-bg px-4 py-3 xl:hidden" aria-label="Hlavní navigace">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={linkCls}>
                  {n.label}
                </NavLink>
              ))}
              {user ? (
                <>
                  <NavLink to="/profil" className={linkCls}>
                    Profil
                  </NavLink>
                  <button onClick={logout} className="px-2.5 py-2 text-left text-sm font-semibold text-muted">
                    Odhlásit
                  </button>
                </>
              ) : (
                <NavLink to="/prihlaseni" className={linkCls}>
                  Přihlásit
                </NavLink>
              )}
            </div>
            <div className="mt-3">
              <ThemeToggle />
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-bg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4 px-4 py-6 text-sm text-muted sm:px-6">
          <p className="max-w-[60ch]">
            Neoficiální studijní pomůcka k předmětu KMA/TGD1 na FAV ZČU v Plzni. Obsah vychází z pracovních textů a folií
            Z. Ryjáčka. Položky se štítkem <span className="hand text-base text-warn">doplněno</span> pocházejí z jiných
            zdrojů.
          </p>
          <div className="flex gap-4">
            <Link to="/#zdroje" className="underline underline-offset-2 hover:text-ink">
              Zdroje obsahu
            </Link>
            <Link to="/#chyba" className="underline underline-offset-2 hover:text-ink">
              Nahlásit chybu
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
