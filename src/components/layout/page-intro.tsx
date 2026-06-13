import { cn } from "@/lib/utils";

type PageIntroProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageIntro({ title, subtitle, actions, className }: PageIntroProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
