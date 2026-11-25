/*
    Parliament (parliament-seats) is a tool for visualizing and calculating
    the distribution of seats in a parliamentary system.

    Copyright (C) 2025 @disfordave

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { ReactNode } from "react";
import ThemeButton from "@/components/ui/settings/ThemeButton";

// Opens in a new tab so the current parliament isn't lost, and says so to
// screen readers
function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      className="underline hover:no-underline"
      href={href}
      rel="noreferrer noopener"
      target="_blank"
    >
      {children}
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-200 p-4 dark:bg-zinc-700">
      <p className="text-sm">
        Basado en{" "}
        <ExternalLink href="https://github.com/disfordave/parliament-seats">
          Parliament Seats
        </ExternalLink>{" "}
        de disfordave.{" "}
        <ExternalLink href="https://github.com/PurnPum/PorraElecciones">
          Código fuente
        </ExternalLink>
        {" · "}
        <ExternalLink href="https://github.com/PurnPum/PorraElecciones/blob/main/LICENSE">
          Licencia AGPL-3.0
        </ExternalLink>
      </p>
      <ThemeButton />
    </footer>
  );
}
