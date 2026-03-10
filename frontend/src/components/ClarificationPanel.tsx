import { useState } from 'react';

interface ClarificationPanelProps {
  questions: string[];
  onSubmit: (answers: string[]) => void;
}

export function ClarificationPanel({ questions, onSubmit }: ClarificationPanelProps) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));

  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(answers);
  }

  const allAnswered = answers.every((a) => a.trim().length > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="gradient-text-pink font-heading text-2xl font-semibold text-center mb-4">
        Clarification Questions
      </h2>
      <p className="text-white/50 text-sm text-center mb-6">
        The pipeline needs more information to proceed.
      </p>

      {questions.map((question, index) => (
        <div key={index} className="inner-card space-y-3">
          <p className="text-white/90 font-medium text-sm leading-relaxed">
            {question}
          </p>
          <textarea
            value={answers[index]}
            onChange={(e) => updateAnswer(index, e.target.value)}
            placeholder="Your answer..."
            rows={2}
          />
        </div>
      ))}

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={!allAnswered}
          className="glow-button text-lg px-8 py-3"
        >
          Submit Answers
        </button>
      </div>
    </form>
  );
}
