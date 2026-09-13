'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { OptionButton } from './OptionButton';
import { ProgressDots } from './ProgressDots';
import { SpinStage } from '@/components/spin/SpinStage';
import { tagsForVibes } from '@/lib/intents/registry';
import type { Intent, PlanFormat, WizardQuestion } from '@/lib/intents/registry';
import { COMPANIONS, PRICE_RANGES } from '@/lib/places/types';
import type { Companion, District, PriceRange } from '@/lib/places/types';
import { useCityShard } from '@/lib/places/useCityShard';
import { CITY_QUERY_KEY, PLAN_QUERY_KEY, encodeCriteria } from '@/lib/recommend/criteria';
import type { Criteria } from '@/lib/recommend/criteria';
import { recommendWithFallback } from '@/lib/recommend/select';
import { composeItinerary, composeTour, encodeItinerary } from '@/lib/recommend/itinerary';
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
  /** Only asked by intents that can answer with a plan rather than one place. */
  format?: PlanFormat;
};

const EMPTY_ANSWERS: Answers = { vibes: [], openNow: false };

/** Kept next to the URL reader: an unknown value from a hand-edited link is dropped. */
const PLAN_FORMATS: readonly PlanFormat[] = ['mot-cho', 'ca-buoi', 'tour-3', 'tour-5'];

function readAnswers(params: URLSearchParams): Answers {
  const companion = params.get('ai');
  const budget = params.get('vi');
  const district = params.get('quan');

  const format = params.get('kieu-hen');

  return {
    ...(COMPANIONS.includes(companion as Companion) ? { companion: companion as Companion } : {}),
    ...(PRICE_RANGES.includes(budget as PriceRange) ? { budget: budget as PriceRange } : {}),
    ...(district ? { districtId: district } : {}),
    ...(PLAN_FORMATS.includes(format as PlanFormat) ? { format: format as PlanFormat } : {}),
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
  if (answers.format) params.set('kieu-hen', answers.format);
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
    case 'format':
      return answers.format !== undefined;
    case 'district':
      // Optional by design — "bất kỳ đâu" is a legitimate answer, so this step is
      // never what stands between the user and a result.
      return true;
  }
}

export function IntentWizard({ intent }: { intent: Intent }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Loaded in the browser rather than server-rendered, so the answer follows the
  // visitor's chosen city instead of always being TP.HCM. The request starts on
  // mount and overlaps the questions that need no data, which is most of them.
  const { status, places, districts, cityId } = useCityShard(intent.categories);

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

  const wantsItinerary = intent.supportsItinerary === true && answers.format === 'ca-buoi';
  // A sightseeing route: same shareable timeline, chosen a different way.
  const tourSize = answers.format === 'tour-3' ? 3 : answers.format === 'tour-5' ? 5 : null;

  // Scoring waits for the data. Running it against an empty list would land on the
  // "chưa tìm được chỗ nào" screen, which is a lie: nothing was searched yet.
  const ready = status === 'ready';

  const itinerary = useMemo(() => {
    if (!ready || !spinning) return null;
    if (tourSize) return composeTour(places, criteria, tourSize);
    return wantsItinerary ? composeItinerary(places, criteria) : null;
  }, [ready, spinning, wantsItinerary, tourSize, places, criteria]);

  // The single-place path is also the fallback when a plan cannot be assembled —
  // two stops short of an evening is worse than one good suggestion.
  const outcome = useMemo(
    () => (ready && spinning && !itinerary ? recommendWithFallback(places, criteria) : null),
    [ready, spinning, itinerary, places, criteria],
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
    const params = encodeCriteria(criteria, intent.id);

    if (itinerary) {
      for (const stop of itinerary.stops) rememberResult(stop.place.id);
      params.set('d', encodeItinerary(itinerary));
      // The plan is three slugs with no city attached, and the itinerary page has
      // to know which shard to look them up in.
      params.set(CITY_QUERY_KEY, cityId);
      if (tourSize) params.set(PLAN_QUERY_KEY, 'tour');
      router.push(`/lich-trinh/?${params.toString()}` as Route);
      return;
    }

    const winner = outcome?.result.winner;
    if (!winner) return;

    // Tell the result page the district could not answer, so it can say so. Being
    // sent across town without explanation is the failure this exists to prevent.
    if (outcome?.result.districtRelaxed) params.set('rong', '1');

    rememberResult(winner.place.id);
    router.push(`/dia-diem/${winner.place.slug}/?${params.toString()}` as Route);
  }, [itinerary, outcome, criteria, intent.id, cityId, tourSize, router]);

  if (status === 'error') {
    return <LoadFailedState onRetry={() => window.location.reload()} />;
  }

  if (spinning) {
    // Someone who answered faster than the network can still be shown the shuffle:
    // it is the same wait either way, and the animation was always covering the
    // scoring pass rather than reporting on it.
    if (!ready) return <PreparingState accent={intent.accent} />;

    if (itinerary) {
      const first = itinerary.stops[0]!;
      return (
        <SpinStage
          candidates={itinerary.stops.map(
            (stop) => `${stop.definition.emoji} ${stop.place.shortName ?? stop.place.name}`,
          )}
          winnerLabel={`${first.place.shortName ?? first.place.name}`}
          landedNote={`và ${itinerary.stops.length - 1} chặng nữa`}
          accent={intent.accent}
          onComplete={handleRevealComplete}
        />
      );
    }

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
        candidates={outcome.result.candidates.map(
          (candidate) => candidate.place.shortName ?? candidate.place.name,
        )}
        winnerLabel={outcome.result.winner.place.shortName ?? outcome.result.winner.place.name}
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
          districtsLoading={!ready}
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
  districtsLoading,
  accentFrom,
  onAnswer,
}: {
  question: WizardQuestion;
  answers: Answers;
  districts: readonly District[];
  districtsLoading: boolean;
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

    case 'format':
      return (
        <>
          {question.options.map((option) => (
            <OptionButton
              key={option.value}
              selected={answers.format === option.value}
              emoji={option.emoji}
              label={option.label}
              hint={option.hint}
              accentFrom={accentFrom}
              onSelect={() => onAnswer({ ...answers, format: option.value }, true)}
            />
          ))}
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

          {/* "Bất kỳ đâu" stays tappable while the districts arrive, so a slow
              connection never blocks the one answer that needs no data at all. */}
          {districtsLoading
            ? Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-12.5 animate-pulse rounded-2xl bg-cream-deep" aria-hidden />
              ))
            : null}

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
 * Shown when the answers arrived before the data did.
 *
 * Deliberately the same shape and accent as the shuffle that follows, so the wait
 * reads as part of the spin rather than as a stall — and it carries no percentage or
 * spinner, because the honest answer is "a moment", not a number.
 */
function PreparingState({ accent }: { accent: Intent['accent'] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <div
        className="size-20 animate-pulse rounded-3xl"
        style={{ backgroundImage: `linear-gradient(120deg, ${accent.from}, ${accent.to})` }}
        aria-hidden
      />
      <p className="text-lg font-semibold" role="status">
        Đang xáo bài…
      </p>
    </div>
  );
}

/**
 * The city's data could not be fetched — offline, or a deploy mid-flight.
 *
 * A reload is the honest fix: there is no cached copy to fall back on, and pretending
 * otherwise would mean recommending from nothing.
 */
function LoadFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl" aria-hidden>
        📡
      </p>
      <h1 className="text-2xl font-bold">Chưa tải được dữ liệu</h1>
      <p className="max-w-xs text-ink-soft">
        Có vẻ mạng đang trục trặc. Kiểm tra kết nối rồi thử lại nhé.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-2xl bg-ink px-5 py-3 font-semibold text-cream"
      >
        Thử lại
      </button>
    </div>
  );
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
