import { ParticlesBackground } from './components/ParticlesBackground';
import { PipelineDashboard } from './components/PipelineDashboard';

export default function App() {
  return (
    <div className="min-h-screen relative">
      <ParticlesBackground />
      <main className="relative z-10 max-w-3xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <h1 className="gradient-text font-heading text-5xl font-bold mb-2">
            Infinite Interns
          </h1>
          <p className="text-white/50 font-heading text-lg">
            AI Pipeline Orchestrator
          </p>
        </header>
        <PipelineDashboard />
      </main>
    </div>
  );
}
