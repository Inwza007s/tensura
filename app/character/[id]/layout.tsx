// Layout for every /character/:id/* page (Status, Hunt, Evolve, Skills).
// Loads the character once (CharacterProvider) and shares it with all four pages.
// เลย์เอาต์ร่วมของหน้าตัวละคร: โหลดข้อมูลตัวละครครั้งเดียวแล้วแชร์ให้ทุกหน้า
import { Suspense } from "react";
import CharacterProvider from "../../components/CharacterProvider";

// Server layout shared by all character sections. The provider reads the URL param with useParams(),
// which Next.js 16 (Cache Components) only allows inside a <Suspense> boundary.
export default function CharacterLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="font-mono text-sm text-muted">LOADING…</p>}>
      <CharacterProvider>{children}</CharacterProvider>
    </Suspense>
  );
}
