import { ArrowRight, BrainCircuit, Building2, CalendarRange, CheckCircle2, Cpu, GraduationCap, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const featureCards = [
  {
    title: 'AI Timetable Design',
    description: 'Generate balanced teaching schedules from faculty availability, room capacity, and course needs.',
    icon: CalendarRange
  },
  {
    title: 'Campus Resource Graph',
    description: 'Track classrooms, laboratories, equipment, and high-demand spaces in one operating view.',
    icon: Building2
  },
  {
    title: 'Optimization Engine',
    description: 'Reduce clashes, surface idle assets, and recommend the best-fit room or lab in real time.',
    icon: BrainCircuit
  }
];

const highlights = [
  'Multi-campus control for classrooms, labs, and facility requests',
  'Faculty, admin, and student experiences connected to one live schedule',
  'Security-first access with role-based control and auditable actions',
  'Operational analytics for utilization, workload, and demand prediction'
];

const metrics = [
  { label: 'Average utilization lift', value: '29%' },
  { label: 'Conflict checks automated', value: '24/7' },
  { label: 'Managed campus assets', value: '12k+' }
];

export function LandingPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <div className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "linear-gradient(115deg, rgba(4,14,32,0.82), rgba(8,38,74,0.45)), url('/login-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,199,212,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.14),transparent_28%)]" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <div className="inline-flex items-center gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-xl">
              <GraduationCap size={22} />
            </div>
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">CollegeOpt AI</p>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Campus orchestration platform</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-200 lg:flex">
            <a href="#capabilities" className="transition hover:text-white">{t('landing.capabilities', 'Capabilities')}</a>
            <a href="#workflow" className="transition hover:text-white">{t('landing.workflow', 'Workflow')}</a>
            <a href="#impact" className="transition hover:text-white">{t('landing.impact', 'Impact')}</a>
            <Link to="/login" className="rounded-full border border-white/20 px-5 py-2.5 transition hover:bg-white/10">
              {t('landing.signIn', 'Sign In')}
            </Link>
          </nav>
        </header>

        <main className="relative z-10 mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-7xl gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-24 lg:pt-14">
          <section className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 backdrop-blur-xl">
              <Sparkles size={16} />
              {t('landing.aiPowered', 'AI-powered college resource optimization')}
            </div>

            <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {t('landing.heroTitle', 'Run the campus like a live operating system.')}
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200/88 sm:text-lg">
              {t('landing.heroDescription', 'Optimize schedules, faculty workload, laboratories, classrooms, and equipment from one intelligent control layer.')}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {t('landing.launchPlatform', 'Launch Platform')}
                <ArrowRight size={16} />
              </Link>
              <a
                href="#capabilities"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/14"
              >
                {t('landing.exploreCapabilities', 'Explore Capabilities')}
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur-xl">
                  <p className="text-3xl font-semibold text-cyan-200">{metric.value}</p>
                  <p className="mt-2 text-sm text-slate-200/78">{metric.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl rounded-[32px] border border-white/12 bg-slate-950/40 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl">
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,26,48,0.88),rgba(9,16,31,0.94))] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/70">Live command view</p>
                    <h2 className="mt-2 text-2xl font-semibold">Campus Pulse</h2>
                  </div>
                  <div className="rounded-2xl bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-300">
                    12 resources auto-routed
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-cyan-300/12 bg-cyan-400/8 p-4">
                    <div className="flex items-center gap-3">
                      <CalendarRange size={18} className="text-cyan-200" />
                      <p className="text-sm font-medium text-slate-100">Schedule pressure</p>
                    </div>
                    <p className="mt-4 text-4xl font-semibold">84%</p>
                    <p className="mt-2 text-sm text-slate-300/75">Peak slots forecasted for Wednesday and Friday afternoons.</p>
                  </div>

                  <div className="rounded-3xl border border-amber-300/12 bg-amber-300/8 p-4">
                    <div className="flex items-center gap-3">
                      <Cpu size={18} className="text-amber-200" />
                      <p className="text-sm font-medium text-slate-100">AI recommendations</p>
                    </div>
                    <p className="mt-4 text-4xl font-semibold">27</p>
                    <p className="mt-2 text-sm text-slate-300/75">Best-fit lab and classroom suggestions generated this hour.</p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-white/8 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300/75">Suggested move</p>
                      <p className="mt-1 text-lg font-semibold">Shift Data Systems to Smart Hall B3</p>
                    </div>
                    <div className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs text-cyan-200">+42 seats</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-900/60 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Capacity</p>
                      <p className="mt-2 text-base font-semibold">96 students</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/60 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Equipment</p>
                      <p className="mt-2 text-base font-semibold">Projector, smart board</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/60 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Conflict risk</p>
                      <p className="mt-2 text-base font-semibold text-emerald-300">Resolved</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <section id="capabilities" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.32em] text-cyan-200/70">Capabilities</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white">Built for universities, not generic office scheduling.</h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-[28px] border border-white/8 bg-white/[0.04] p-7 backdrop-blur-xl">
              <div className="inline-flex rounded-2xl bg-cyan-400/12 p-3 text-cyan-200">
                <card.icon size={22} />
              </div>
              <h3 className="mt-5 text-2xl font-semibold">{card.title}</h3>
              <p className="mt-3 text-base leading-7 text-slate-300/82">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,20,38,0.94),rgba(12,31,48,0.94))] p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-amber-200/70">Why teams switch</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight">From static timetables to adaptive campus planning.</h2>
          <div className="mt-8 space-y-4">
            {highlights.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-white/6 bg-white/[0.04] p-4">
                <CheckCircle2 className="mt-0.5 text-emerald-300" size={18} />
                <p className="text-sm leading-6 text-slate-200/84">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-8">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-cyan-200" />
              <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/70">Operations flow</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-900/60 p-5">
                <p className="text-sm text-slate-400">1. Capture</p>
                <h3 className="mt-3 text-xl font-semibold">Collect demand</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300/80">Gather course loads, room constraints, faculty windows, and equipment requests.</p>
              </div>
              <div className="rounded-3xl bg-slate-900/60 p-5">
                <p className="text-sm text-slate-400">2. Optimize</p>
                <h3 className="mt-3 text-xl font-semibold">Run AI allocation</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300/80">Detect clashes, assign best-fit resources, and expose utilization gaps instantly.</p>
              </div>
              <div className="rounded-3xl bg-slate-900/60 p-5">
                <p className="text-sm text-slate-400">3. Operate</p>
                <h3 className="mt-3 text-xl font-semibold">Monitor live campus</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300/80">Track approvals, availability, and bottlenecks from a single dashboard layer.</p>
              </div>
            </div>
          </div>

          <div id="impact" className="rounded-[30px] border border-white/8 bg-[linear-gradient(140deg,rgba(14,48,76,0.85),rgba(10,19,35,0.98))] p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/70">Campus ready</p>
                <h2 className="mt-3 text-3xl font-semibold">Move from promotional page to working platform.</h2>
              </div>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                Open Sign In
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-200/80">
              <div className="inline-flex items-center gap-2">
                <MapPin size={16} className="text-cyan-200" />
                Multi-campus deployment
              </div>
              <div className="inline-flex items-center gap-2">
                <Cpu size={16} className="text-cyan-200" />
                Real-time recommendation engine
              </div>
              <div className="inline-flex items-center gap-2">
                <Building2 size={16} className="text-cyan-200" />
                Classroom, lab, and facility operations
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
