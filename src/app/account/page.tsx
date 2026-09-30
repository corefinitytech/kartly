import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/modules/auth/session";

export default async function AccountOverviewPage() {
  const user = await requireUser();
  const cards = [
    { href: "/account/profile", title: "Profile", text: "Name, phone and sign in details." },
    { href: "/account/addresses", title: "Addresses", text: "Delivery and billing addresses." },
    { href: "/account/security", title: "Security", text: "Change your password." },
  ];
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Your account</h1>
        <Badge variant={user.emailVerified ? "success" : "default"}>
          {user.emailVerified ? "Verified" : "Not verified"}
        </Badge>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="flex min-h-24 flex-col rounded-card border border-line bg-surface p-4 transition-theme hover:border-lineStrong"
            >
              <span className="flex items-center justify-between text-lg font-semibold">
                {card.title}
                <ChevronRight strokeWidth={1.75} className="h-5 w-5 text-inkMuted" />
              </span>
              <span className="mt-1 text-sm text-inkSoft">{card.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
