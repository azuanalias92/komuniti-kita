import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { TasksProvider } from "./components/tasks-provider";
import { TasksTable } from "./components/tasks-table";

export function Tasks() {
  return (
    <TasksProvider>
      <Header />
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro title="Directory" subtitle="Browse houses, owners, and registered vehicles." />
        <TasksTable />
      </Main>
    </TasksProvider>
  );
}
