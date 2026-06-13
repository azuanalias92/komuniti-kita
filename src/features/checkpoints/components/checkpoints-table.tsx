import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { type NavigateFn, useTableUrlState } from "@/hooks/use-table-url-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { type Checkpoint } from "../data/schema";
import { checkpointsColumns as columns } from "./checkpoints-columns";
import { useAuthStore } from "@/stores/auth-store";
// removed unused header-related imports

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

type DataTableProps = {
  data?: Checkpoint[];
  search: Record<string, unknown>;
  navigate: NavigateFn;
};

export function CheckpointsTable({ data, search, navigate }: DataTableProps) {
  // Local UI-only states
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  // Synced with URL states
  const { columnFilters, onColumnFiltersChange, pagination, onPaginationChange } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [{ columnId: "name", searchKey: "name", type: "string" }],
  });

  const nameFilter = (columnFilters.find((f) => (f as { id: string }).id === "name") as { value: string })?.value as string | undefined;

  const {
    data: apiData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "checkpoints",
      {
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        name: nameFilter || "",
      },
    ],
    queryFn: async () => {
      const url = new URL("/api/checkpoints", window.location.origin);
      url.searchParams.set("page", String(pagination.pageIndex + 1));
      url.searchParams.set("pageSize", String(pagination.pageSize));
      if (nameFilter) url.searchParams.set("name", nameFilter);

      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 204) return { data: [] as Checkpoint[], total: 0, pageSize: pagination.pageSize };
      if (!res.ok) throw new Error("Failed to load checkpoints");
      const json = await res.json().catch(() => ({ data: [], total: 0, pageSize: pagination.pageSize }));
      const rawList = Array.isArray(json?.data) ? json.data : [];
      const list = rawList
        .map((c: any) => ({
          id: String(c?.id ?? ""),
          name: String(c?.name ?? ""),
          latitude: Number(c?.latitude ?? 0),
          longitude: Number(c?.longitude ?? 0),
          createdAt: new Date(c?.createdAt ?? new Date().toISOString()),
          updatedAt: new Date(c?.updatedAt ?? new Date().toISOString()),
        }))
        .filter(
          (c: Checkpoint) => c.id && c.name && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && isValidDate(c.createdAt) && isValidDate(c.updatedAt),
        ) as Checkpoint[];
      return { data: list, total: Number(json.total ?? list.length), pageSize: Number(json.pageSize ?? pagination.pageSize) };
    },
    enabled: !data,
  });

  const tableData = data || (apiData?.data ?? []);
  const serverTotal = apiData?.total ?? undefined;
  const serverPageSize = apiData?.pageSize ?? pagination.pageSize;
  const computedPageCount = serverTotal ? Math.max(1, Math.ceil(serverTotal / serverPageSize)) : undefined;

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    enableRowSelection: true,
    onPaginationChange,
    onColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: !!serverTotal,
    pageCount: computedPageCount,
  });

  return (
    <Card className={cn('max-sm:has-[div[role="toolbar"]]:mb-16', "flex flex-1 flex-col")}>
      <CardContent className="flex flex-1 flex-col gap-4">
        {isLoading && <div className="text-muted-foreground">Loading checkpoints...</div>}
        {error && <div className="text-destructive">{(error as Error).message}</div>}
        <DataTableToolbar table={table} searchPlaceholder="Filter checkpoints..." searchKey="name" filters={[]} />
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="group/row">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={cn(
                          "bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted",
                          header.column.columnDef.meta?.className,
                          header.column.columnDef.meta?.thClassName,
                        )}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="group/row">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted",
                          cell.column.columnDef.meta?.className,
                          cell.column.columnDef.meta?.tdClassName,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} className="mt-auto" />
      </CardContent>
    </Card>
  );
}
