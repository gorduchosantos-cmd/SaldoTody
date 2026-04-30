import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  ChevronRight, 
  Wallet, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  AlertCircle, 
  ArrowLeft,
  Banknote,
  Utensils,
  Car,
  Palmtree,
  Settings,
  Sparkles
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
};

// --- Models & Types ---
interface Spending {
  food: number;
  transport: number;
  leisure: number;
  fixed: number;
}

interface Results {
  totalSpend: number;
  amountToSave: number;
  freeBalance: number;
  spending: Spending;
}

// --- Components ---

const InputField = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = "number",
  icon: Icon,
  helperText
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  type?: string;
  icon?: any;
  helperText?: string;
}) => (
  <div className="mb-6">
    <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
      {Icon && <Icon size={16} className="text-gray-400" />}
      {label}
    </label>
    <div className="relative">
      <input 
        type={type} 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} 
        className="w-full bg-gray-50/50 border border-gray-100 rounded-xl p-4 focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all outline-none text-lg"
      />
    </div>
    {helperText && <p className="text-[10px] text-gray-400 mt-1 italic">{helperText}</p>}
  </div>
);

const SummaryCard = ({ label, amount, colorClass, delay = 0, subtext }: { label: string; amount: number; colorClass: string; delay?: number; subtext?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="tech-card p-5"
  >
    <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{label}</div>
    <div className={cn("text-2xl font-mono", colorClass)}>
      {formatCurrency(amount)}
    </div>
    {subtext && <div className="mt-2 text-[10px] text-gray-600 font-mono">{subtext}</div>}
  </motion.div>
);

export default function App() {
  const [income, setIncome] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('25');
  const [spending, setSpending] = useState<Spending>({
    food: 0,
    transport: 0,
    leisure: 0,
    fixed: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [aiTip, setAiTip] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  const performAiSplit = async (incVal: number): Promise<Spending> => {
    setIsSplitting(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Como um consultor financeiro, sugira uma distribuição semanal para uma renda de ${formatCurrency(incVal)}. 
      Retorne APENAS um objeto JSON válido no formato: {"food": número, "transport": número, "leisure": número, "fixed": número}. 
      Priorize as necessidades básicas (alimentação e fixos) e reserve uma margem para transporte.`;

      const response = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview", 
        contents: prompt 
      });
      
      // Clean up response text in case of markdown blocks
      const cleanJson = response.text?.replace(/```json|```/g, '').trim() || '{}';
      const parsed = JSON.parse(cleanJson);
      
      const suggestedSpending = {
        food: parsed.food || 0,
        transport: parsed.transport || 0,
        leisure: parsed.leisure || 0,
        fixed: parsed.fixed || 0
      };

      setSpending(suggestedSpending);
      return suggestedSpending;
    } catch (e) {
      console.error("Split error:", e);
      // Fallback 50/30/20-ish logic
      const fallback = {
        food: incVal * 0.3,
        transport: incVal * 0.1,
        leisure: incVal * 0.1,
        fixed: incVal * 0.2
      };
      setSpending(fallback);
      return fallback;
    } finally {
      setIsSplitting(false);
    }
  };

  const handleProcess = async () => {
    const incVal = parseFloat(income) || 0;
    if (incVal <= 0) {
      alert("Por favor, insira o quanto você recebeu para esta semana.");
      return;
    }

    setIsProcessing(true);

    // Check if user has entered any spending. If not, auto-split.
    let finalSpending = spending;
    const isSpendingEmpty = Object.values(spending).every(v => v === 0);
    
    if (isSpendingEmpty) {
      finalSpending = await performAiSplit(incVal);
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    const totalSpend = finalSpending.food + finalSpending.transport + finalSpending.leisure + finalSpending.fixed;
    const amountToSave = (incVal * (parseFloat(savingsGoal) || 0)) / 100;
    const freeBalance = incVal - totalSpend - amountToSave;

    const newResults: Results = {
      totalSpend,
      amountToSave,
      freeBalance,
      spending: finalSpending
    };

    setResults(newResults);
    setIsProcessing(false);
    generateAiTip(incVal, newResults);
  };

  const generateAiTip = async (inc: number, res: Results) => {
    setIsLoadingAi(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Você é um especialista em finanças pessoais. Analise os dados semanais: Renda ${formatCurrency(inc)}, Reserva ${formatCurrency(res.amountToSave)}, Saldo ${formatCurrency(res.freeBalance)}. Dê uma dica técnica e direta (máximo 2 frases) em pt-BR.`;
      const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
      setAiTip(response.text || "Operação nominal. Mantenha os parâmetros atuais.");
    } catch (e) {
      setAiTip(res.freeBalance < 0 ? "Ajuste imediato necessário: reduza variáveis para restaurar solvência." : "Parâmetros estáveis. Considere alocação excedente em ativos de liquidez.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const chartData = useMemo(() => {
    if (!results) return [];
    return [
      { name: 'Alimentação', value: results.spending.food, color: '#F43F5E' },
      { name: 'Transporte', value: results.spending.transport, color: '#F59E0B' },
      { name: 'Lazer', value: results.spending.leisure, color: '#3B82F6' },
      { name: 'Fixos', value: results.spending.fixed, color: '#10B981' }
    ].filter(d => d.value > 0);
  }, [results]);

  return (
    <div className="min-h-screen flex flex-col border-t-4 border-[#3B82F6]">
      {/* Tech Header */}
      <header className="flex items-center justify-between px-8 h-16 border-b border-[#1E293B] bg-[#111827]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#3B82F6] rounded flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/20">S</div>
          <h1 className="text-xl font-semibold tracking-tight">Saldo<span className="text-[#3B82F6]">DoTody</span></h1>
          <span className="tag-mono hidden sm:inline-block">V2.5.1-PRO</span>
        </div>
        <div className="flex gap-6 text-[10px] text-gray-500 font-mono uppercase tracking-widest items-center">
          <span className="hidden md:inline">Semana: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — Fluxo Real</span>
          <div className="flex items-center gap-1.5 text-[#10B981]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
            Sistema Online
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {!results && !isProcessing && (
            <motion.section 
              key="inputs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid lg:grid-cols-[400px_1fr] gap-8 items-start"
            >
              <div className="tech-card p-6 bg-[#0F172A]">
                <h2 className="tech-label text-blue-400 border-b border-gray-800 pb-3 mb-6 flex items-center gap-2">
                  <Banknote size={14} /> Configuração de Entrada
                </h2>
                
                <div className="space-y-6">
                  <div className="bg-[#1E293B] p-4 rounded border border-gray-700/50">
                    <label className="tech-label">Renda Semanal (Disponível)</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-mono text-sm">R$</span>
                      <input 
                        type="number" 
                        value={income}
                        onChange={(e) => setIncome(e.target.value)}
                        placeholder="0,00"
                        className="bg-transparent border-none text-2xl font-mono text-white outline-none w-full"
                      />
                    </div>
                  </div>

                  <div className="bg-[#1E293B] p-4 rounded border border-gray-700/50">
                    <label className="tech-label">Meta de Reserva (%)</label>
                    <div className="flex items-center justify-between gap-4">
                      <input 
                        type="number" 
                        value={savingsGoal}
                        onChange={(e) => setSavingsGoal(e.target.value)}
                        className="bg-transparent border-none text-2xl font-mono text-white outline-none w-20"
                      />
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-[#3B82F6]" 
                          animate={{ width: `${Math.min(100, Math.max(0, parseFloat(savingsGoal) || 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="tech-card p-6 bg-[#0F172A]">
                <h2 className="tech-label text-blue-400 border-b border-gray-800 pb-3 mb-6 flex items-center gap-2">
                  <Settings size={14} /> Vetores de Gasto
                </h2>
                
                <div className="grid sm:grid-cols-2 gap-x-12 gap-y-6">
                  {[
                    { id: 'food', label: 'Alimentação', icon: Utensils },
                    { id: 'transport', label: 'Transporte', icon: Car },
                    { id: 'leisure', label: 'Lazer / Extras', icon: Palmtree },
                    { id: 'fixed', label: 'Contas Fixas', icon: Settings },
                  ].map((cat) => (
                    <div key={cat.id} className="relative group">
                      <label className="tech-label group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                        <cat.icon size={12} className="opacity-50" />
                        {cat.label}
                      </label>
                      <div className="flex items-center gap-2 border-b border-gray-800 group-focus-within:border-blue-400 transition-all pb-1">
                        <span className="text-[10px] font-mono text-gray-500">R$</span>
                        <input 
                          type="number" 
                          placeholder="0,00"
                          className="w-full bg-transparent border-none text-white font-mono outline-none py-1"
                          onChange={(e) => setSpending(s => ({ ...s, [cat.id]: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-12">
                  <button 
                    onClick={handleProcess}
                    disabled={isProcessing || isSplitting}
                    className="tech-button w-full py-4 text-[11px] uppercase tracking-[2px] font-bold flex items-center justify-center gap-2 group"
                  >
                    {Object.values(spending).every(v => v === 0) ? (
                      <>
                        <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                        AI Smart Split & Análise
                      </>
                    ) : (
                      <>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        Gerar Análise Prospectiva
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] text-gray-600 font-mono mt-4">
                    {Object.values(spending).every(v => v === 0) 
                      ? "SEM VALORES? A IA IRÁ DISTRIBUIR AUTOMATICAMENTE" 
                      : "ESTIMATIVA BASEADA EM ALGORITMOS DE FLUXO SEMANAL"}
                  </p>
                </div>
              </div>
            </motion.section>
          )}

          {isProcessing && (
            <motion.section 
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40 bg-[#111827] rounded-lg border border-[#1E293B]"
            >
              <div className="w-8 h-8 border-2 border-gray-800 border-t-[#3B82F6] rounded-full animate-spin mb-4" />
              <p className="text-gray-500 font-mono text-[10px] tracking-[4px] uppercase animate-pulse">Sincronizando Dados Financeiros</p>
            </motion.section>
          )}

          {results && (
            <motion.section 
              key="results"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid lg:grid-rows-[auto_1fr] gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard 
                  label="Gasto Acumulado" 
                  amount={results.totalSpend} 
                  colorClass="text-rose-500" 
                  subtext={`${((results.totalSpend / (parseFloat(income) || 1)) * 100).toFixed(1)}% do aporte total`}
                  delay={0.1} 
                />
                <SummaryCard 
                  label={`Reserva (Meta ${savingsGoal}%)`} 
                  amount={results.amountToSave} 
                  colorClass="text-[#10B981]" 
                  subtext="Alocado para custódia de emergência"
                  delay={0.2} 
                />
                <SummaryCard 
                  label="Excedente Líquido" 
                  amount={results.freeBalance} 
                  colorClass={results.freeBalance < 0 ? "text-rose-500" : "text-white"} 
                  subtext="Disponível para reinvestimento"
                  delay={0.3} 
                />
              </div>

              <div className="grid lg:grid-cols-[1fr_400px] gap-6 h-[500px]">
                <div className="tech-card p-6 flex flex-col items-center justify-center bg-[#0F172A]">
                  <h3 className="tech-label self-start border-b border-gray-800 w-full mb-8 pb-3">
                    Vetor de Composição Semanal
                  </h3>
                  <div className="w-full h-full max-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          innerRadius="75%"
                          outerRadius="90%"
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '4px', fontSize: '12px' }}
                          itemStyle={{ color: '#E0E0E0' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend verticalAlign="bottom" iconType="rect" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '20px', fontFamily: 'monospace' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="tech-card p-6 flex flex-col bg-[#0F172A]">
                  <h3 className="tech-label border-b border-gray-800 w-full mb-6 pb-3">
                    Diagnóstico de IA (Gemini Engine)
                  </h3>
                  
                  <div className="flex-1 space-y-4">
                    <div className={cn(
                      "p-4 rounded border flex gap-4",
                      results.freeBalance < 0 
                        ? "bg-rose-900/10 border-rose-900/30 text-rose-100" 
                        : "bg-emerald-900/10 border-emerald-900/30 text-emerald-100"
                    )}>
                      <div className="text-xl">
                        {results.freeBalance < 0 ? "⚠️" : "✓"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wider mb-1">
                          {results.freeBalance < 0 ? 'Déficit Detectado' : 'Status: Nominal'}
                        </p>
                        <p className="text-[11px] opacity-70 leading-relaxed font-mono">
                          {results.freeBalance < 0 
                            ? `Fluxo negativo de ${formatCurrency(Math.abs(results.freeBalance))}. Reajuste de prioridades é mandatório.` 
                            : `Excedente de ${formatCurrency(results.freeBalance)} verificado. Saúde financeira em patamar verde.`}
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-blue-400" />
                        <span className="text-[10px] font-bold uppercase text-blue-400 tracking-wider">Insight Estratégico</span>
                      </div>
                      <div className="min-h-[60px] flex items-center">
                        {isLoadingAi ? (
                          <div className="flex gap-1.5">
                            <div className="w-1.5 h-1.5 bg-blue-400/50 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-blue-400/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 bg-blue-400/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        ) : (
                          <p className="text-xs text-blue-100 leading-relaxed font-mono italic">
                             {aiTip}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-gray-800 flex justify-between items-center">
                    <button 
                      onClick={() => setResults(null)}
                      className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase tracking-[2px] font-mono flex items-center gap-2 group"
                    >
                      <ArrowLeft size={10} /> REBOOT CALC_ENGINE
                    </button>
                    <span className="text-[9px] text-gray-700 font-mono">ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="h-10 mt-auto border-t border-[#1E293B] bg-[#111827] flex items-center justify-between px-8 text-[9px] text-gray-600 font-mono uppercase tracking-widest">
        <div className="flex gap-8">
          <span>MD-CORE: 4.2.1</span>
          <span>STABILITY: [HGH]</span>
        </div>
        <div>© 2024 SALDODOTODY PLATFORM — ENCRYPTION [V3-AES]</div>
      </footer>
    </div>
  );
}
