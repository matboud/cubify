import Playground from "@/components/Playground";
import Settings from "@/components/Settings";

export default function Home() {
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <Playground />
      </div>
      <div className="w-72 shrink-0 border-l border-white/10">
        <Settings />
      </div>
    </div>
  );
}
