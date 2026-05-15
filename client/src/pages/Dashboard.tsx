// Startsida med statistiköversikt och snabblänkar
import { useNavigate } from 'react-router-dom';
import { useStats } from '../hooks/useStats';
import { ProgressBar } from '../components/ProgressBar';
import { SectionBadge } from '../components/SectionBadge';
import { ALL_SECTIONS, KI_TARGET_SCORE } from '../lib/sectionColors';
import type { Section } from '../lib/types';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold text-ki-blue">{value}</div>
      <div className="text-sm font-medium text-ki-text mt-0.5">{label}</div>
      {sub && <div className="text-xs text-ki-gray-dark mt-0.5">{sub}</div>}
    </div>
  );
}

function getMotivation(hpScore: number, streak: number): string {
  if (hpScore >= 2.0) return 'Fantastiskt! Du är på KI-nivå. Håll kvar prestationerna!';
  if (hpScore >= 1.7) return 'Du är nära målet! Fokusera på dina svaga sektioner.';
  if (hpScore >= 1.4) return 'Bra jobbat! Fortsätt pressa på — du utvecklas!';
  if (streak >= 7) return `${streak} dagar i rad! Konsistens är nyckeln till framgång.`;
  if (streak === 0) return 'Börja öva idag — varje fråga för dig närmre KI!';
  return 'Håll fokus och öva lite varje dag. Du klarar det!';
}

export function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading } = useStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-ki-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hp = stats?.estimatedHpScore ?? 0;
  const streak = stats?.streak ?? 0;
  const hpPct = (hp / KI_TARGET_SCORE) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Välkomstbanner */}
      <div className="bg-gradient-to-br from-ki-blue to-ki-blue-light rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium opacity-80 mb-1">Ditt mål</div>
            <h1 className="text-2xl font-bold">Läkarprogrammet</h1>
            <div className="text-sm opacity-90">Karolinska Institutet</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium opacity-80 mb-1">Krav</div>
            <div className="font-mono text-3xl font-bold text-ki-gold">2.0</div>
            <div className="text-xs opacity-80">HP-poäng</div>
          </div>
        </div>

        {/* HP-progress mot KI */}
        <div className="mt-4">
          <div className="flex justify-between text-xs opacity-80 mb-1">
            <span>Din uppskattade poäng</span>
            <span className="font-mono font-bold">{hp.toFixed(2)} / 2.0</span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full">
            <div
              className="h-2 bg-ki-gold rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, hpPct)}%` }}
            />
          </div>
        </div>

        <p className="mt-3 text-sm opacity-90 italic">{getMotivation(hp, streak)}</p>
      </div>

      {/* Statistikkort */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Frågor övade"
          value={stats?.totalAnswered ?? 0}
        />
        <StatCard
          label="Snittresultat"
          value={stats ? `${Math.round(stats.accuracy * 100)}%` : '—'}
        />
        <StatCard
          label="Streak"
          value={streak}
          sub={streak === 1 ? 'dag' : 'dagar i rad'}
        />
        <StatCard
          label="HP-poäng (est.)"
          value={hp.toFixed(2)}
          sub="/ 2.0"
        />
      </div>

      {/* Snabbknappar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Öva nu', sub: 'Välj sektioner', icon: '✏️', to: '/practice', primary: true },
          { label: 'Simulera prov', sub: 'Under tidspress', icon: '⏱️', to: '/simulation', primary: false },
          { label: 'Se statistik', sub: 'Din progress', icon: '📊', to: '/stats', primary: false },
          { label: 'Flashcards', sub: 'Bygg ordförråd', icon: '🗂️', to: '/flashcards', primary: false },
        ].map(({ label, sub, icon, to, primary }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`card text-center hover:shadow-md transition-all cursor-pointer ${
              primary ? 'border-ki-blue bg-ki-blue-pale' : ''
            }`}
          >
            <div className="text-3xl mb-2">{icon}</div>
            <div className={`font-semibold text-sm ${primary ? 'text-ki-blue' : 'text-ki-text'}`}>{label}</div>
            <div className="text-xs text-ki-gray-dark mt-0.5">{sub}</div>
          </button>
        ))}
      </div>

      {/* Progress per sektion */}
      <div className="card">
        <h2 className="font-semibold text-ki-text mb-4">Progress per sektion</h2>
        <div className="space-y-3">
          {ALL_SECTIONS.map((section) => {
            const s = stats?.perSection[section as Section];
            const pct = s && s.totalQuestions > 0 ? (s.answered / s.totalQuestions) * 100 : 0;
            const acc = s ? Math.round(s.accuracy * 100) : 0;

            return (
              <div key={section} className="flex items-center gap-3">
                <SectionBadge section={section} size="sm" />
                <div className="flex-1">
                  <ProgressBar
                    value={pct}
                    height="thin"
                    showPercent={false}
                    color="bg-ki-blue"
                  />
                </div>
                <div className="text-xs text-ki-gray-dark w-20 text-right">
                  {s ? `${s.answered}/${s.totalQuestions}` : '0/0'}
                  {s && s.answered > 0 && (
                    <span className={`ml-1 font-medium ${acc >= 70 ? 'text-green-600' : acc >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      ({acc}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
