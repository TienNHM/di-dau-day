import type { Metadata } from 'next';
import { WizardScreen } from '@/components/wizard/WizardScreen';
import { getIntent } from '@/lib/intents/registry';

const intent = getIntent('di-dau')!;

export const metadata: Metadata = {
  title: intent.title,
  description: intent.subtitle,
  alternates: { canonical: intent.path },
};

export default function Page() {
  return <WizardScreen intentId="di-dau" />;
}
