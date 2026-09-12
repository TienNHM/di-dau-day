'use client';

import { useSearchParams } from 'next/navigation';
import { ContributeForm } from './ContributeForm';

/**
 * Reads the place being reported from the URL.
 *
 * The place page links here with everything it already knows, rather than this page
 * shipping a slug lookup table for 4,189 places it would almost never use.
 */
export function ContributeScreen() {
  const params = useSearchParams();
  const slug = params.get('ve');
  const name = params.get('ten');

  if (!slug || !name) return <ContributeForm />;

  return (
    <ContributeForm
      defaultKind="bo-sung"
      place={{
        slug,
        name,
        ...(params.get('tp') ? { city: params.get('tp')! } : {}),
        ...(params.get('quan') ? { district: params.get('quan')! } : {}),
      }}
    />
  );
}
