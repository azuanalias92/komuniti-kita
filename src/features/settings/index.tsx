import { Outlet } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";

export function Settings() {
  return (
    <>
      <Header />
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro title="Configuration" subtitle="Manage Check-in Settings." />
        <Outlet />
      </Main>
    </>
  );
}
