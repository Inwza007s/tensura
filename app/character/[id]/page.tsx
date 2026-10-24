import { Suspense } from "react";
import CharacterView from "../../components/CharacterView";

// Server wrapper. The client component reads the URL param with useParams(), which Next.js 16
// (Cache Components) only allows inside a <Suspense> boundary.
export default function CharacterPage() {
  return (
    <Suspense fallback={<p className="font-mono text-sm text-muted">LOADING…</p>}>
      <CharacterView />
    </Suspense>
  );
}
