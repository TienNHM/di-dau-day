import type { Metadata } from 'next';
import { WizardScreen } from '@/components/wizard/WizardScreen';
import { getIntent } from '@/lib/intents/registry';
import { absoluteUrl } from '@/lib/site';

const intent = getIntent('an-gi')!;

export const metadata: Metadata = {
  title: intent.title,
  description: intent.subtitle,
  alternates: { canonical: absoluteUrl(`${intent.path}/`) },
};

export default function Page() {
  return <WizardScreen intentId="an-gi" />;
}
