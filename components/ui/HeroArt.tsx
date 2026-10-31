/* eslint-disable @next/next/no-img-element */

// Desktop: crisp 3360px Kitsu art when available, otherwise a soft banner wash + sharp key art.
export function HeroArt({
  backdrop,
  banner,
  cover,
  eager = false,
  animate = true,
}: {
  backdrop?: string | null;
  banner?: string | null;
  cover: string;
  eager?: boolean;
  animate?: boolean;
}) {
  const loading = eager ? "eager" : "lazy";
  return (
    <>
      {/* mobile: portrait key art */}
      <img
        src={cover}
        alt=""
        loading={loading}
        className={`absolute inset-0 h-full w-full object-cover object-[50%_22%] lg:hidden ${animate ? "aa-xfade" : ""}`}
      />
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          loading={loading}
          fetchPriority={eager ? "high" : "auto"}
          className={`absolute inset-0 hidden h-full w-full object-cover object-[70%_30%] lg:block ${animate ? "aa-xfade" : ""}`}
        />
      ) : (
        <div className="absolute inset-0 hidden lg:block">
          <img
            src={banner || cover}
            alt=""
            loading={loading}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl saturate-150"
          />
          <div className="absolute inset-y-0 right-[calc(var(--gutter)+3vw)] flex items-center pb-[clamp(110px,13vw,210px)] pt-[calc(var(--header-h)+16px)]">
            <img
              src={cover}
              alt=""
              loading={loading}
              fetchPriority={eager ? "high" : "auto"}
              className={`h-[min(52vh,27vw)] w-auto rounded-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 ${animate ? "aa-xfade" : ""}`}
            />
          </div>
        </div>
      )}
    </>
  );
}
