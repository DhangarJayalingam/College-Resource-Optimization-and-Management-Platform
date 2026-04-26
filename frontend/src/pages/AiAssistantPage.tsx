import { FormEvent, useEffect, useState } from 'react';
import { Bot, BrainCircuit, Lightbulb, MessageSquare, Send, Sparkles, TrendingUp } from 'lucide-react';
import { SectionCard } from '../components/SectionCard';
import { getAiInsights, getAiPredictions, getAiRecommendations, queryAiAssistant } from '../services/api';
import type { AiChatResponse, AiInsight, AiPanelResponse, AiPrediction, AiRecommendation, RoleType } from '../types';
import { getCurrentUserRoles } from '../utils/auth';

type ChatMessage = {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
};

const roleHeadings: Record<RoleType, { badge: string; title: string; subtitle: string }> = {
  SUPER_ADMIN: {
    badge: 'Principal AI',
    title: 'Campus-wide decision intelligence',
    subtitle: 'Compare departments, spot underutilized assets, and act on demand forecasts before bottlenecks hit.'
  },
  COLLEGE_ADMIN: {
    badge: 'HOD AI',
    title: 'Department operations assistant',
    subtitle: 'Track faculty load, fix timetable pressure, and surface lab optimization opportunities for your department.'
  },
  FACULTY: {
    badge: 'Faculty AI',
    title: 'Schedule and booking copilot',
    subtitle: 'Find rooms, avoid clashes, and get practical recommendations for your teaching workflow.'
  },
  STUDENT: {
    badge: 'Student AI',
    title: 'Academic help desk',
    subtitle: 'Check your next class, find free rooms, and summarize announcements with a quick chat.'
  }
};

function toneClasses(level: string) {
  switch (level.toLowerCase()) {
    case 'high':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-300';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300';
  }
}

export function AiAssistantPage() {
  const roles = getCurrentUserRoles();
  const activeRole = roles.includes('SUPER_ADMIN')
    ? 'SUPER_ADMIN'
    : roles.includes('COLLEGE_ADMIN')
      ? 'COLLEGE_ADMIN'
      : roles.includes('FACULTY')
        ? 'FACULTY'
        : 'STUDENT';
  const heading = roleHeadings[activeRole];

  const [insights, setInsights] = useState<AiPanelResponse<AiInsight> | null>(null);
  const [recommendations, setRecommendations] = useState<AiPanelResponse<AiRecommendation> | null>(null);
  const [predictions, setPredictions] = useState<AiPanelResponse<AiPrediction> | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatQuery, setChatQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAssistant() {
      try {
        setLoading(true);
        setError('');
        const [insightData, recommendationData, predictionData] = await Promise.all([
          getAiInsights(),
          getAiRecommendations(),
          getAiPredictions()
        ]);
        setInsights(insightData);
        setRecommendations(recommendationData);
        setPredictions(predictionData);
        setChatMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: `I am your ${insightData.role.replace('_', ' ')} assistant. ${insightData.samplePrompts[0] ?? 'Ask me anything about your schedule, resources, or announcements.'}`
          }
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load AI assistant');
      } finally {
        setLoading(false);
      }
    }

    loadAssistant();
  }, []);

  async function handleChatSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = chatQuery.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed
    };
    setChatMessages((current) => [...current, userMessage]);
    setChatQuery('');

    try {
      setChatLoading(true);
      const response = await queryAiAssistant(trimmed);
      appendAssistantResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI chat failed');
    } finally {
      setChatLoading(false);
    }
  }

  function appendAssistantResponse(response: AiChatResponse) {
    setChatMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.answer
      }
    ]);
  }

  async function runPrompt(prompt: string) {
    setChatQuery(prompt);
    try {
      setChatLoading(true);
      setChatMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, sender: 'user', text: prompt }
      ]);
      const response = await queryAiAssistant(prompt);
      appendAssistantResponse(response);
      setChatQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI chat failed');
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="space-y-6 fade-up">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/20">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.24),transparent_28%),radial-gradient(circle_at_left,rgba(251,191,36,0.18),transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_55%,#0b3954_100%)] px-6 py-8 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <Sparkles size={14} />
                {heading.badge}
              </p>
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">{heading.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{heading.subtitle}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-right backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Assistant Scope</p>
              <p className="mt-2 text-2xl font-semibold text-white">{insights?.scope ?? 'Loading...'}</p>
              <p className="mt-1 text-xs text-slate-300/80">Role-aware responses using live platform data</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <SectionCard title="AI Assistant" subtitle="Loading live role-aware insights">
          <p className="text-sm text-slate-500 dark:text-slate-400">Collecting analytics, timetable, booking, and announcement signals...</p>
        </SectionCard>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {insights?.items.slice(0, 3).map((item) => (
              <article
                key={item.title}
                className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/55"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_40%)]" />
                <div className="relative">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${toneClasses(item.severity)}`}>
                    {item.severity}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">{item.title}</p>
                  <p className="mt-2 text-2xl font-bold">{item.metric}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.summary}</p>
                </div>
              </article>
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard title="AI Chat" subtitle="Ask for role-aware help powered by live system data">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(insights?.samplePrompts ?? []).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => runPrompt(prompt)}
                      disabled={chatLoading}
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-3xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                          message.sender === 'user'
                            ? 'bg-cyan-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                          {message.sender === 'assistant' ? <Bot size={13} /> : <MessageSquare size={13} />}
                          {message.sender}
                        </div>
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        Generating response from live system context...
                      </div>
                    </div>
                  ) : null}
                </div>

                <form onSubmit={handleChatSubmit} className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={chatQuery}
                    onChange={(event) => setChatQuery(event.target.value)}
                    placeholder="Ask about rooms, demand, timetable conflicts, or announcements"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
                  >
                    <Send size={16} />
                    Send
                  </button>
                </form>
              </div>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard title="Recommendations" subtitle="Suggested actions based on your role and current system state">
                <div className="space-y-3">
                  {recommendations?.items.map((item) => (
                    <article key={item.title} className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(item.priority)}`}>
                          {item.priority}
                        </div>
                      </div>
                      <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300">
                        <Lightbulb size={15} />
                        {item.action}
                      </p>
                    </article>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Predictions" subtitle="Forward-looking signals derived from live platform activity">
                <div className="space-y-3">
                  {predictions?.items.map((item) => (
                    <article key={item.title} className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <TrendingUp size={16} />
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">{item.confidence} confidence</p>
                      </div>
                      <p className="mt-3 font-semibold">{item.title}</p>
                      <p className="mt-2 text-2xl font-bold">{item.predictedValue}</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          <SectionCard title="Assistant Modules" subtitle="How the AI assistant is integrated into SmartCampus">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="inline-flex items-center gap-2 text-sm font-semibold"><BrainCircuit size={16} /> Insight Engine</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Reads analytics, activity logs, resources, timetable, bookings, and announcements to surface meaningful operational signals.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="inline-flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} /> Recommendation Engine</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Suggests actionable next steps based on role, workload, resource availability, and system pressure.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="inline-flex items-center gap-2 text-sm font-semibold"><MessageSquare size={16} /> Chat Assistant</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Answers role-aware questions using live application data and quick prompt shortcuts.</p>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
