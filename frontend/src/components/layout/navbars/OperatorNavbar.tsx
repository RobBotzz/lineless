import { Link } from "react-router";

import logoPlaceholder from "../../../assets/LLlogo.png";
import { buttonVariants } from "../../ui/button";
import { Navbar } from "./Navbar";

type NavbarLink = { label: string; to: string };

type OperatorNavbarProps = {
  logoSrc?: string;
  title?: string;
  centerLinks?: NavbarLink[];
  rightLink?: NavbarLink;
};

const defaultCenter: NavbarLink[] = [
  { label: "Home", to: "#" },
  { label: "Impact", to: "#" },
  { label: "Pricing", to: "#" },
];

const defaultRight: NavbarLink = { label: "Sign up", to: "#" };

export function OperatorNavbar({
  logoSrc,
  title = "Lineless",
  centerLinks = defaultCenter,
  rightLink = defaultRight,
}: OperatorNavbarProps) {
  return (
    <Navbar
      left={
        <Link className="inline-flex items-center gap-3" to="/">
          <img
            alt={`${title} Logo`}
            className="h-10 w-10 rounded-xl object-contain"
            src={logoSrc ?? logoPlaceholder}
          />
        </Link>
      }
      center={
        <div className="flex items-center gap-2">
          {centerLinks.map((link) => (
            <Link
              key={link.label}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </div>
      }
      right={
        <Link className={buttonVariants({ variant: "default", size: "sm" })} to={rightLink.to}>
          {rightLink.label}
        </Link>
      }
    />
  );
}