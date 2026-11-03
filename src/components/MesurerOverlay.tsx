import { lazy, Suspense } from 'react';

// Inspector/annotation overlay, on localhost or with ?dev=1 (so the live site can be marked up too).
// Mesurer itself is fetched only then; regular visitors never download it.
const Mesurer = lazy(() => import('mesurer').then(module => ({ default: module.Mesurer })));
const enabled = ['localhost', '127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).has('dev');

export default function MesurerOverlay() {
  return enabled ? <Suspense fallback={null}><Mesurer /></Suspense> : null;
}
