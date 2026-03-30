// components/Loader.jsx
// Skeleton card grid — matches the real card layout so the UI doesn't jump

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse"
         style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)'}}>
      <div className="h-48 bg-white/10" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-white/10 rounded-full w-full" />
        <div className="h-3 bg-white/10 rounded-full w-3/4" />
        <div className="flex gap-1 mt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 w-3 bg-white/10 rounded-full" />
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="h-6 bg-white/10 rounded-full w-20" />
          <div className="h-8 bg-white/10 rounded-xl w-24" />
        </div>
      </div>
    </div>
  );
}

export default function Loader({ count = 8 }) {
  return (
    <div>
      <div className="h-14 rounded-2xl animate-pulse mb-6"
           style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)'}} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(count)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}
