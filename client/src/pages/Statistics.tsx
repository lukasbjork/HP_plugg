// Statistiksida med grafer, heatmap och AI-studieplan
import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import '../lib/heatmap.css';
import { useStats } from '../hooks/useStats';
import { fetchWeakAreas, fetchHistory, fetchSectionHistory, generateStudyPlan } from '../lib/api';
import { SectionBadge } from '../components/SectionBadge';
import { ProgressBar } from '../components/ProgressBar';
import { ALL_SECTIONS, KI_TARGET_SCORE } from '../lib/sectionColors';
import type { Section, HistoryEntry, SectionHistoryEntry } from '../lib/types';

const SECTION_LINE_COLORS: Partial<Record<Section, string>> = {
  ORD: '#7C3AED', LÄS: '#2563EB', MEK: '#0891B2',
  XYZ: '#059669', KVA: '#D97706', NOG: '#DC2626', DTK: '#7C3AED',
};

export function Statistics() {
  const { stats, loading } = useStats();
  const [weakAreas, setWeakAreas] = useState<Array<{ section: string; accuracy: number; answered: number }>>([]);
  const [heatmap, setHeatmap] = useState<HistoryEntry[]>([]);
  const [lineData, setLineData] = useState<SectionHistoryEntry[]>([]);
  const [aiPlan, setAiPlan] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    fetchWeakAreas().then(d => setWeakAreas(d.weakAreas)).catch(() => {});
    fetchHistory().then(d => setHeatmap(d.history)).catch(() => {});
    fetchSectionHistory(undefined, 60).then(d => setLineData(d.history)).catch(() => {});
  }, []);

  // Gruppera linjediagram-data per datum
  const groupedLine: Record<string, Record<string, number>> = {};
  for (const entry of lineData) {
    if (!groupedLine[entry.date]) groupedLine[entry.date] = {};
    groupedLine[entry.date][entry.section] = Math.round(entry.accuracy * 100);
  }
  const chartData = Object.entries(groupedLine)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, secs]) => ({ date: date.slice(5), ...secs }));

  const handleGeneratePlan = async () => {
    if (!stats) return;
    setShowPlan(true);
    setAiLoading(true);
    setAiPlan('');
    await generateStudyPlan(
      stats.perSection,
      targetDate || 'okänt datum',
      (chunk) => setAiPlan(prev => prev + chunk),
      () => setAiLoading(false),
      (err) => { setAiPlan(`Fel: ${err}`); setAiLoading(false); }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-ki-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hp = stats?.estimatedHpScore ?? 0;
  const distToKI = Math.max(0, KI_TARGET_SCORE - hp);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ki-text">Statistik</h1>
        <div className="text-right">
          <div className="text-xs text-ki-gray-dark">HP-poäng (est.)</div>
          <div className="font-mono text-2xl font-bold text-ki-blue">{hp.toFixed(2)}</div>
        </div>
      </div>

      {/* KI-avstånd */}
      {distToKI > 0 ? (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-amber-800">Avstånd till KI</div>
              <div className="text-sm text-amber-700 mt-0.5">Behöver förbättra med {distToKI.toFixed(2)} HP-poäng</div>
            </div>
            <div className="font-mono text-2xl font-bold text-amber-600">-{distToKI.toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div className="card bg-green-50 border-green-200">
          <div className="font-semibold text-green-800">✓ Du når KI:s antagningsgräns!</div>
          <div className="text-sm text-green-700 mt-0.5">HP ≥ 2.0 uppnått. Fortsätt bibehålla nivån.</div>
        </div>
      )}

      {/* Träffsäkerhet per sektion */}
      <div className="card">
        <h2 className="font-semibold text-ki-text mb-4">Träffsäkerhet per sektion</h2>
        <div className="space-y-3">
          {ALL_SECTIONS.map(s => {
            const sec = stats?.perSection[s as Section];
            const acc = sec ? Math.round(sec.accuracy * 100) : 0;
            const color = acc >= 70 ? 'bg-green-500' : acc >= 50 ? 'bg-amber-500' : 'bg-red-400';
            return (
              <div key={s} className="flex items-center gap-3">
                <SectionBadge section={s as Section} size="sm" />
                <ProgressBar
                  value={acc}
                  height="normal"
                  showPercent={false}
                  color={color}
                />
                <div className="text-sm w-28 text-right">
                  <span className="font-medium">{acc}%</span>
                  <span className="text-ki-gray-dark ml-1 text-xs">
                    ({sec?.answered ?? 0} svar)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Svaga områden */}
      {weakAreas.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-ki-text mb-3">Svaga områden</h2>
          <div className="space-y-2">
            {weakAreas.map(({ section, accuracy, answered }) => (
              <div key={section} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-red-500">⚠️</span>
                  <SectionBadge section={section as Section} size="sm" />
                </div>
                <div className="text-sm text-red-700 font-medium">
                  {Math.round(accuracy * 100)}% rätt av {answered} svar
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linjediagram */}
      {chartData.length > 1 && (
        <div className="card">
          <h2 className="font-semibold text-ki-text mb-4">Resultatutveckling (60 dagar)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(val: number) => `${val}%`} />
              <Legend />
              {ALL_SECTIONS.filter(s => chartData.some(d => s in d)).map(s => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={SECTION_LINE_COLORS[s as Section] ?? '#999'}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aktivitetsheatmap */}
      {heatmap.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-ki-text mb-4">Studieaktivitet (365 dagar)</h2>
          <div className="overflow-x-auto">
            <CalendarHeatmap
              startDate={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)}
              endDate={new Date()}
              values={heatmap.map(h => ({ date: h.date, count: h.count }))}
              classForValue={(value) => {
                if (!value || value.count === 0) return 'color-empty';
                if (value.count < 5) return 'color-scale-1';
                if (value.count < 15) return 'color-scale-2';
                if (value.count < 30) return 'color-scale-3';
                return 'color-scale-4';
              }}
              tooltipDataAttrs={(value) => ({
                'data-tip': value && (value as { date: string; count: number }).count > 0
                  ? `${(value as { date: string; count: number }).date}: ${(value as { date: string; count: number }).count} svar`
                  : '',
              }) as Record<string, string>}
              showWeekdayLabels
            />
          </div>
        </div>
      )}

      {/* AI-studieplan */}
      <div className="card">
        <h2 className="font-semibold text-ki-text mb-3">AI-studieplan</h2>
        <div className="flex gap-3 mb-3">
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="border border-ki-gray-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ki-blue"
            placeholder="Provdatum"
          />
          <button onClick={handleGeneratePlan} disabled={aiLoading} className="btn-primary">
            {aiLoading ? 'Genererar...' : '✨ Generera plan'}
          </button>
        </div>
        {showPlan && (
          <div className="mt-3 p-4 bg-ki-blue-pale rounded-xl">
            {aiLoading && !aiPlan && (
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-ki-blue rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-ki-blue rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-ki-blue rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            )}
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-ki-text text-sm leading-relaxed">
              {aiPlan}
            </div>
            {aiLoading && aiPlan && <span className="inline-block w-1 h-4 bg-ki-blue animate-pulse ml-0.5" />}
          </div>
        )}
      </div>
    </div>
  );
}
