'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { OptionButton } from './OptionButton';
import { ProgressDots } from './ProgressDots';
import { SpinStage } from '@/components/spin/SpinStage';
import { tagsForVibes } from '@/lib/intents/registry';
import type { Intent, WizardQuestion } from '@/lib/intents/registry';
import { COMPANIONS, PRICE_RANGES } from '@/lib/places/types';
import type { Companion, District, PlaceSummary, PriceRange } from '@/lib/places/types';
import { encodeCriteria } from '@/lib/recommend/criteria';
import type { Criteria } from '@/lib/recommend/criteria';
import { recommendWithFallback } from '@/lib/recommend/select';
import { readRecentIds, rememberResult } from '@/lib/recommend/recent';
import { track } from '@/lib/analytics/track';

/**
 * The wizard state machine.
 *
 * Answers live in the URL as well as in React state. That is what makes a
 * half-finished flow survive a refresh, makes the back button behave, and lets the
 * result page's "Chọn lại" hand the same answers straight back here with one place
 * excluded — no shared store, no server round trip.
 */

type Answers = {
  companion?: Companion;
  budget?: PriceRange;
  vibes: readonly string[];
  districtId?: string;
  openNow: boolean;
};

const EMPTY_ANSWERS: Answers = { vibes: [], openNow: false };

function readAnswers(params: URLSearchParams): Answers {
  const companion = params.get('ai');
  const budget = params.get('vi');
  const district = params.get('quan');

  return {
    ...(COMPANIONS.includes(companion as Companion) ? { companion: companion as Companion } : {}),
    ...(PRICE_RANGES.includes(budget as PriceRange) ? { budget: budget as PriceRange } : {}),
    ...(district ? { districtId: district } : {}),
    vibes: (params.get('kieu') ?? '').split(',').filter(Boolean),
    openNow: params.get('mo') === '1',
  };
}

function answersToParams(answers: Answers): URLSearchParams {
  const params = new URLSearchParams();
  if (answers.companion) params.set('ai', answers.companion);
  if (answers.budget) params.set('vi', answers.budget);
  if (answers.districtId) params.set('quan', answers.districtId);
  if (answers.vibes.length > 0) params.set('kieu', answers.vibes.join(','));
  if (answers.openNow) params.set('mo', '1');
  return params;
}

function isAnswered(question: WizardQuestion, answers: Answers): boolean {
  switch (question.kind) {
    case 'companion':
      return answers.companion !== undefined;
    case 'budget':
      return answers.budget !== undefined;
    case 'vibe':
      return answers.vibes.length > 0;
    case 'district':
      // Optional by design — "bất kỳ đâu" is a legitimate answer, so this step is
      // never what stands between the user and a result.
      return true;
  }
}

export function IntentWizard({
  intent,
  places,
  districts,
}: {
  intent: Intent;
  places: readonly PlaceSummary[];
  districts: readonly District[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [answers, setAnswers] = useState<Answers>(() =>
    readAnswers(new URLSearchParams(searchParams.toString())),
  );
  // `spin=1` on the URL means "you already have my answers, just pick" — how the
  // result page's "Chọn lại" comes back here without asking everything again.
  const [step, setStep] = useState(0);
  const [spinning, setSpinning] = useState(() => searchParams.get('spin') === '1');

  const excludeIds = useMemo(
    () => (searchParams.get('spin') === '1' ? readRecentIds() : []),
    [searchParams],
  );

  const criteria = useMemo<Criteria>(() => {
    const vibeQuestion = intent.questions.find((question) => question.kind === 'vibe');
    const tags = vibeQuestion ? tagsForVibes(vibeQuestion, answers.vibes) : [];
    const district = districts.find((candidate) => candidate.id === answers.districtId);

    return {
      categories: intent.categories,
      ...(answers.companion ? { companion: answers.companion } : {}),
      ...(answers.budget ? { budget: answers.budget } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(answers.districtId ? { districtId: answers.districtId } : {}),
      ...(district ? { origin: { lat: district.lat, lng: district.lng } } : {}),
      ...(answers.openNow ? { openNow: true } : {}),
      ...(excludeIds.length > 0 ? { excludeIds } : {}),
    };
  }, [intent, answers, districts, excludeIds]);

  const outcome = useMemo(
    () => (spinning ? recommendWithFallback(places, criteria) : null),
    [spinning, places, criteria],
  );

  const update = useCallback(
    (next: Answers) => {
      setAnswers(next);
      // replaceState rather than router.replace: this is a same-page state mirror,
      // and pushing a history entry per tap would make Back walk answer by answer.
      const params = answersToParams(next);
      const query = params.toString();
      window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    },
    [setAnswers],
  );

  const advance = useCallback(() => {
    setStep((current) => {
      const question = intent.questions[current];
      if (question) track('wizard_answer', { intent: intent.id, step: current, kind: question.kind });

      if (current + 1 < intent.questions.length) return current + 1;

      track('spin_start', { intent: intent.id });
      setSpinning(true);
      return current;
    });
  }, [intent]);

  const handleRevealComplete = useCallback(() => {
    const winner = outcome?.result.winner;
    if (!winner) return;

    rememberResult(winner.place.id);

    const params = encodeCriteria(criteria, intent.id);
    router.push(`/dia-diem/${winner.place.slug}/?${params.toString()}` as Route);
  }, [outcome, criteria, intent.id, router]);

  if (spinning) {
    if (!outcome) {
      return (
        <EmptyState
          intent={intent}
          onRetry={() => {
            setSpinning(false);
            setStep(0);
            update(EMPTY_ANSWERS);
          }}
        />
      );
    }

    return (
      <SpinStage
        candidates={outcome.result.candidates}
        winner={outcome.result.winner}
        accent={intent.accent}
        onComplete={handleRevealComplete}
      />
    );
  }

  const question = intent.questions[step];
  if (!question) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-4">
        <ProgressDots
          total={intent.questions.length}
          current={step}
          accentFrom={intent.accent.from}
        />
        <button
          type="button"
          onClick={() => (step === 0 ? router.push('/') : setStep(step - 1))}
          className="text-sm font-medium text-ink-faint underline-offset-4 hover:text-ink hover:underline"
        >
          {step === 0 ? 'Về trang chủ' : 'Quay lại'}
        </button>
      </div>

      <h1 className="mt-8 text-3xl leading-tight font-extrabold tracking-tight text-balance">
        {question.title}
      </h1>
      {'hint' in question && question.hint ? (
        <p className="mt-2 text-ink-soft">{question.hint}</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2.5">
        <QuestionOptions
          question={question}
          answers={answers}
          districts={districts}
          accentFrom={intent.accent.from}
          onAnswer={(next, shouldAdvance) => {
            update(next);
            if (shouldAdvance) {
              // A beat of feedback before moving on, so the tap registers visually.
              setTimeout(advance, 160);
            }
          }}
        />
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {question.kind === 'district' ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-line">
            <input
              type="checkbox"
              checked={answers.openNow}
              onChange={(event) => update({ ...answers, openNow: event.target.checked })}
              className="size-5 accent-brand"
            />
            <span className="text-sm font-medium">Chỉ chỗ đang mở cửa</span>
          </label>
        ) : null}

        <button
          type="button"
          onClick={advance}
          disabled={!isAnswered(question, answers)}
          className="w-full rounded-2xl px-5 py-4 text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-35"
          style={{
            backgroundImage: `linear-gradient(120deg, ${intent.accent.from}, ${intent.accent.to})`,
          }}
        >
          {step === intent.questions.length - 1 ? '🎲 Chọn cho tôi' : 'Tiếp tục'}
        </button>
      </div>
    </div>
  );
}

function QuestionOptions({
  question,
  answers,
  districts,
  accentFrom,
  onAnswer,
}: {
  question: WizardQuestion;
  answers: Answers;
  districts: readonly District[];
  accentFrom: string;
  onAnswer: (next: Answers, shouldAdvance: boolean) => void;
}) {
  switch (question.kind) {
    case 'companion':
      return (
        <>
          {question.options.map((option) => (
            <OptionButton
              key={option.value}
              selected={answers.companion === option.value}
              emoji={option.emoji}
              label={option.label}
              accentFrom={accentFrom}
              onSelect={() => onAnswer({ ...answers, companion: option.value }, true)}
            />
          ))}
        </>
      );

    case 'budget':
      return (
        <>
          {question.options.map((option) => (
            <OptionButton
              key={option.value}
              selected={answers.budget === option.value}
              label={option.label}
              {...(option.hint ? { hint: option.hint } : {})}
              accentFrom={accentFrom}
              onSelect={() => onAnswer({ ...answers, budget: option.value }, true)}
            />
          ))}
        </>
      );

    case 'vibe':
      // Multi-select, so tapping never auto-advances — the user decides when done.
      return (
        <>
          {question.options.map((option) => {
            const selected = answers.vibes.includes(option.value);
            return (
              <OptionButton
                key={option.value}
                selected={selected}
                emoji={option.emoji}
                label={option.label}
                accentFrom={accentFrom}
                onSelect={() =>
                  onAnswer(
                    {
                      ...answers,
                      vibes: selected
                        ? answers.vibes.filter((value) => value !== option.value)
                        : [...answers.vibes, option.value],
                    },
                    false,
                  )
                }
              />
            );
          })}
        </>
      );

    case 'district':
      return (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              const { districtId: _dropped, ...rest } = answers;
              onAnswer(rest, true);
            }}
            className={`col-span-2 rounded-2xl border-2 px-4 py-3 font-semibold transition active:scale-[0.98] ${
              answers.districtId === undefined
                ? 'border-transparent bg-white shadow-md shadow-ink/5'
                : 'border-line bg-white/60'
            }`}
            style={answers.districtId === undefined ? { borderColor: accentFrom } : undefined}
          >
            🗺️ Bất kỳ đâu
          </button>

          {districts.map((district) => {
            const selected = answers.districtId === district.id;
            return (
              <button
                key={district.id}
                type="button"
                onClick={() => onAnswer({ ...answers, districtId: district.id }, true)}
                className={`rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                  selected
                    ? 'border-transparent bg-white shadow-md shadow-ink/5'
                    : 'border-line bg-white/60'
                }`}
                style={selected ? { borderColor: accentFrom } : undefined}
              >
                {district.shortName}
              </button>
            );
          })}
        </div>
      );
  }
}

/**
 * Reached only when even the fully relaxed criteria match nothing — in practice, a
 * category with no seed data yet. Always offers a way forward rather than a dead end.
 */
function EmptyState({ intent, onRetry }: { intent: Intent; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl" aria-hidden>
        🤔
      </p>
      <h1 className="text-2xl font-bold">Chưa tìm được chỗ nào</h1>
      <p className="max-w-xs text-ink-soft">
        Tụi mình chưa có đủ địa điểm cho mục “{intent.label}”. Thử bỏ bớt điều kiện xem sao.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-2xl bg-ink px-5 py-3 font-semibold text-cream"
      >
        Chọn lại từ đầu
      </button>
    </div>
  );
}
