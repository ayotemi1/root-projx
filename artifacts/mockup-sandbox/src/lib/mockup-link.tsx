import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type MockupLinkProps = PropsWithChildren<
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>;

export function MockupLink({ href, children, ...props }: MockupLinkProps) {
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
      }}
    >
      {children}
    </a>
  );
}
