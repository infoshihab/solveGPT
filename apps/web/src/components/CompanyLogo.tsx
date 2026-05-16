import Image from "next/image";

/** Official logo: file at `public/logo (2).png` (space before parenthesis). */
export const COMPANY_LOGO_PATH = encodeURI("/logo (2).png");

type Props = {
  className?: string;
  /** Tailwind height class, e.g. `h-10` */
  heightClass?: string;
  priority?: boolean;
  /**
   * Scale artwork inside the layout box; outer size stays defined by `heightClass`
   * (uses the official asset aspect 240×64 so width tracks height).
   */
  innerZoom?: number;
};

export function CompanyLogo({
  className = "",
  heightClass = "h-10",
  priority = false,
  innerZoom = 1,
}: Props) {
  const zoomed = innerZoom > 1.001;

  if (zoomed) {
    return (
      <span
        className={`relative block overflow-hidden [aspect-ratio:240/64] ${heightClass} ${className}`.trim()}
      >
        <Image
          src={COMPANY_LOGO_PATH}
          alt="SolveGPT"
          fill
          priority={priority}
          sizes="200px"
          className="object-contain object-left"
          style={{
            transform: `scale(${innerZoom})`,
            transformOrigin: "left center",
          }}
        />
      </span>
    );
  }

  return (
    <Image
      src={COMPANY_LOGO_PATH}
      alt="SolveGPT"
      width={240}
      height={64}
      priority={priority}
      className={`w-auto object-contain object-left ${heightClass} ${className}`.trim()}
    />
  );
}
