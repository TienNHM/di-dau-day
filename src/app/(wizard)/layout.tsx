import { PageShell } from '@/components/ui/PageShell';

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
