'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Hlídáme, jestli je uživatel přihlášený
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        // Pokud není přihlášený, šup s ním na login
        router.push('/login');
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Chyba při odhlašování:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Načítání...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Boční menu (Sidebar) */}
      <aside className="w-64 border-r border-slate-800 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-400 mb-8">School IDE</h1>
          <nav className="space-y-2">
            <a href="/dashboard" className="block px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium">
              🏠 Přehled
            </a>
            <a href="#" className="block px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white text-sm font-medium transition">
              📝 Poznámky
            </a>
            <a href="#" className="block px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white text-sm font-medium transition">
              ✅ Úkoly
            </a>
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-2 px-4 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
        >
          Odhlásit se
        </button>
      </aside>

      {/* Hlavní obsah */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-bold">Vítej zpět, {user.displayName || 'Studente'}! 👋</h2>
            <p className="text-slate-400 text-sm">Tady je tvůj osobní studijní prostor.</p>
          </div>

          <div className="flex items-center gap-4">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt="Profilovka"
                className="w-10 h-10 rounded-full border border-slate-700"
              />
            )}
            <button
              onClick={handleLogout}
              className="md:hidden py-2 px-3 bg-red-500/10 text-red-400 text-xs rounded-lg"
            >
              Odhlásit
            </button>
          </div>
        </header>

        {/* Sekce karet / widgetů */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-semibold mb-2 text-indigo-300">Rychlé poznámky</h3>
            <p className="text-slate-400 text-sm mb-4">Zatím žádné poznámky. Brzy je napojíme na databázi.</p>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition">
              + Nová poznámka
            </button>
          </div>

          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-semibold mb-2 text-indigo-300">Úkoly a Deadliny</h3>
            <p className="text-slate-400 text-sm mb-4">Žádné nadcházející úkoly.</p>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl transition">
              + Přidat úkol
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
