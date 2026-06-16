import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { DataTableColumnHeader, DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface CheckInLog {
  id: string;
  checkpointId: string;
  checkpointName?: string;
  userId?: string;
  userName?: string;
  timestamp: string;
  date: Date;
}

type CheckInLogRow = CheckInLog & {
  resolvedCheckpointName: string;
  resolvedUserName: string;
};

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

export function CheckInLogs() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sorting, setSorting] = useState<SortingState>([{ id: "timestamp", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Fetch check-in logs from API
  const { data: checkIns = [], isLoading } = useQuery({
    queryKey: ["check-in-logs"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/check-in", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return [];
      const json = res.status === 204 ? [] : await res.json();
      return (json as any[])
        .map((item) => ({
          id: item.id,
          checkpointId: item.checkpointId || item.checkpoint_id,
          checkpointName: item.checkpointName || item.checkpoint_name,
          userId: item.userId || item.user_id,
          userName: item.userName || item.user_name,
          timestamp: item.timestamp || item.created_at,
          date: new Date(item.timestamp || item.created_at),
        }))
        .filter((item) => item.id && isValidDate(item.date));
    },
  });

  // Fetch checkpoints for names
  const { data: checkpoints = [] } = useQuery({
    queryKey: ["checkpoints"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/checkpoints", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return [];
      const json = res.status === 204 ? { data: [] } : await res.json();
      return json.data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-for-check-in-logs"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/users?pageSize=100", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    (users as any[]).forEach((u) => {
      const id = String(u.id ?? "");
      const name = String((u.firstName || "") + " " + (u.lastName || "")).trim() || String(u.username || "");
      if (id) map.set(id, name || id);
    });
    return map;
  }, [users]);

  const tableData = useMemo<CheckInLogRow[]>(() => {
    const checkpointNameById = new Map<string, string>();
    (checkpoints as any[]).forEach((checkpoint) => {
      const id = String(checkpoint.id ?? "");
      const name = String(checkpoint.name ?? "").trim();
      if (id) checkpointNameById.set(id, name || id);
    });

    let filtered = checkIns.map((log) => {
      const checkpointId = String(log.checkpointId || "");
      return {
        ...log,
        resolvedCheckpointName: checkpointNameById.get(checkpointId) || log.checkpointName || checkpointId || "-",
        resolvedUserName: userNameById.get(String(log.userId)) || log.userName || log.userId || "-",
      };
    });

    if (dateFrom) {
      filtered = filtered.filter((log) => log.date >= dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter((log) => log.date <= endOfDay);
    }

    return filtered;
  }, [checkIns, checkpoints, userNameById, dateFrom, dateTo]);

  const columns = useMemo<ColumnDef<CheckInLogRow>[]>(
    () => [
      {
        accessorKey: "resolvedCheckpointName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Checkpoint" />,
        cell: ({ row }) => <span className="font-medium">{row.original.resolvedCheckpointName}</span>,
      },
      {
        accessorKey: "resolvedUserName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
      },
      {
        accessorKey: "timestamp",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => format(row.original.date, "dd/MM/yyyy"),
        sortingFn: (left, right) => left.original.date.getTime() - right.original.date.getTime(),
      },
      {
        id: "time",
        accessorFn: (row) => format(row.date, "HH:mm:ss"),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{format(row.original.date, "HH:mm:ss")}</span>,
        sortingFn: (left, right) => left.original.date.getTime() - right.original.date.getTime(),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).trim().toLowerCase();
      if (!searchValue) return true;

      return (
        row.original.resolvedCheckpointName.toLowerCase().includes(searchValue) ||
        row.original.resolvedUserName.toLowerCase().includes(searchValue) ||
        format(row.original.date, "dd/MM/yyyy HH:mm:ss").toLowerCase().includes(searchValue)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [globalFilter, dateFrom, dateTo]);

  const totalLogs = table.getFilteredRowModel().rows.length;

  const exportLogs = () => {
    const csvContent = [
      ["Checkpoint", "User", "Date", "Time"],
      ...table.getSortedRowModel().rows.map((row) => {
        const log = row.original;
        return [log.resolvedCheckpointName, log.resolvedUserName, format(log.date, "yyyy-MM-dd"), format(log.date, "HH:mm:ss")];
      }),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `check-in-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header />
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro
          title="Check-in Logs"
          subtitle="Review and export check-in records."
          actions={
            <Button onClick={exportLogs} variant="outline" size="sm" disabled={totalLogs === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          }
        />
        <Card className={cn('max-sm:has-[div[role="toolbar"]]:mb-16', "flex flex-1 flex-col")}>
          <CardContent className="flex flex-1 flex-col gap-4">
            <DataTableToolbar
              table={table}
              searchPlaceholder="Filter by checkpoint, user, or date..."
              extraContent={
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Date From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Date To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDateFrom(undefined);
                        setDateTo(undefined);
                      }}
                      disabled={!dateFrom && !dateTo}
                    >
                      Reset Dates
                    </Button>
                  </div>
                </div>
              }
            />

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        {isLoading ? "Loading check-in logs..." : checkIns.length === 0 ? "No check-in records found." : "No records match your filters."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination table={table} className="mt-auto" />
          </CardContent>
        </Card>
      </Main>
    </>
  );
}
