import Image from "next/image";

/** Official logo: file at `public/logo (2).png` (space before parenthesis). */
export const COMPANY_LOGO_PATH = encodeURI("/logo (2).png");

type Props = {
  className?: string;
  /** Tailwind height class, e.g. `h-10` */
  heightClass?: string;
  priority?: boolean;
};

export function CompanyLogo({ className = "", heightClass = "h-10", priority = false }: Props) {
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
