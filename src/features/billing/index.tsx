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
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeSwitch } from "@/components/theme-switch";
import { Search } from "@/components/search";
import { ConfigDrawer } from "@/components/config-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader, DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { cn } from "@/lib/utils";

type SummaryRow = {
  houseId: string;
  houseNo: string;
  amountDue: number;
  amountPaid: number;
  debit: number;
  credit: number;
  status: string;
};

type PaymentRow = {
  id: string;
  houseId: string;
  houseNo: string;
  amount: number;
  receiptKey: string;
  paymentDate: string;
  status: string;
};

function formatMoney(value: number) {
  return Number(value || 0).toFixed(2);
}

export function Billing() {
  const [frequency, setFrequency] = useState<string>("monthly");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [summarySorting, setSummarySorting] = useState<SortingState>([]);
  const [summaryColumnVisibility, setSummaryColumnVisibility] = useState<VisibilityState>({});
  const [summaryGlobalFilter, setSummaryGlobalFilter] = useState("");
  const [summaryPagination, setSummaryPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [paymentsSorting, setPaymentsSorting] = useState<SortingState>([]);
  const [paymentsColumnVisibility, setPaymentsColumnVisibility] = useState<VisibilityState>({});
  const [paymentsGlobalFilter, setPaymentsGlobalFilter] = useState("");
  const [paymentsPagination, setPaymentsPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data } = useQuery<{ frequency: string; rate: number; period: { start: string; end: string } | null; data: SummaryRow[] }>({
    queryKey: ["billing:summary", frequency, year, month],
    queryFn: async () => {
      const params = new URLSearchParams({ frequency, year });
      if (frequency === "monthly") params.set("month", month);
      const res = await fetch(`/api/billing/summary?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load summary");
      return await res.json();
    },
  });

  const rows = data?.data || [];
  const periodLabel = data?.period ? `${data.period.start} → ${data.period.end}` : "No billing settings yet";

  const { data: residents } = useQuery<{ id: string; houseNo: string }[]>({
    queryKey: ["residents:list-basic"],
    queryFn: async () => {
      const res = await fetch("/api/residents?page=1&pageSize=1000");
      if (res.status === 204) return [];
      const json = await res.json();
      return (json.data || []).map((r: any) => ({ id: r.id, houseNo: r.houseNo }));
    },
  });

  const residentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of residents || []) m.set(r.id, r.houseNo);
    return m;
  }, [residents]);

  const { data: payments } = useQuery<{ id: string; house_id: string; amount: number; receipt_key: string; payment_date: string; status: string }[]>({
    queryKey: ["billing:payments", data?.period?.start, data?.period?.end],
    enabled: !!data?.period?.start && !!data?.period?.end,
    queryFn: async () => {
      if (!data?.period) return [];
      const { start, end } = data.period;
      const params = new URLSearchParams({ start, end, status: "confirmed" });
      const res = await fetch(`/api/billing/payments?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load payments");
      return await res.json();
    },
  });

  const paymentRows = useMemo<PaymentRow[]>(
    () =>
      (payments || []).map((payment) => ({
        id: payment.id,
        houseId: payment.house_id,
        houseNo: residentMap.get(payment.house_id) || payment.house_id,
        amount: Number(payment.amount || 0),
        receiptKey: payment.receipt_key,
        paymentDate: payment.payment_date,
        status: payment.status,
      })),
    [payments, residentMap],
  );

  const summaryColumns = useMemo<ColumnDef<SummaryRow>[]>(
    () => [
      {
        accessorKey: "houseNo",
        header: ({ column }) => <DataTableColumnHeader column={column} title="House" />,
      },
      {
        accessorKey: "amountDue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
        cell: ({ row }) => formatMoney(row.original.amountDue),
      },
      {
        accessorKey: "amountPaid",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Paid" />,
        cell: ({ row }) => formatMoney(row.original.amountPaid),
      },
      {
        accessorKey: "debit",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Debit" />,
        cell: ({ row }) => <span className={row.original.debit ? "text-red-600" : undefined}>{formatMoney(row.original.debit)}</span>,
      },
      {
        accessorKey: "credit",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Credit" />,
        cell: ({ row }) => <span className={row.original.credit ? "text-green-600" : undefined}>{formatMoney(row.original.credit)}</span>,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      },
    ],
    [],
  );

  const paymentColumns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      {
        accessorKey: "paymentDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      },
      {
        accessorKey: "houseNo",
        header: ({ column }) => <DataTableColumnHeader column={column} title="House" />,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
        cell: ({ row }) => formatMoney(row.original.amount),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge variant={row.original.status === "confirmed" ? "default" : row.original.status === "rejected" ? "destructive" : "secondary"}>{row.original.status}</Badge>
        ),
      },
      {
        accessorKey: "receiptKey",
        header: "Receipt",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.receiptKey ? (
            <a className="text-primary underline" href={`/api/r2/${row.original.receiptKey}`} target="_blank" rel="noreferrer">
              View
            </a>
          ) : (
            "-"
          ),
      },
    ],
    [],
  );

  const summaryTable = useReactTable({
    data: rows,
    columns: summaryColumns,
    state: {
      sorting: summarySorting,
      columnVisibility: summaryColumnVisibility,
      globalFilter: summaryGlobalFilter,
      pagination: summaryPagination,
    },
    onSortingChange: setSummarySorting,
    onColumnVisibilityChange: setSummaryColumnVisibility,
    onGlobalFilterChange: setSummaryGlobalFilter,
    onPaginationChange: setSummaryPagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).trim().toLowerCase();
      if (!searchValue) return true;

      return row.original.houseNo.toLowerCase().includes(searchValue) || row.original.status.toLowerCase().includes(searchValue);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const paymentsTable = useReactTable({
    data: paymentRows,
    columns: paymentColumns,
    state: {
      sorting: paymentsSorting,
      columnVisibility: paymentsColumnVisibility,
      globalFilter: paymentsGlobalFilter,
      pagination: paymentsPagination,
    },
    onSortingChange: setPaymentsSorting,
    onColumnVisibilityChange: setPaymentsColumnVisibility,
    onGlobalFilterChange: setPaymentsGlobalFilter,
    onPaginationChange: setPaymentsPagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).trim().toLowerCase();
      if (!searchValue) return true;

      return (
        row.original.houseNo.toLowerCase().includes(searchValue) ||
        row.original.status.toLowerCase().includes(searchValue) ||
        row.original.paymentDate.toLowerCase().includes(searchValue)
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
    setSummaryPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [summaryGlobalFilter, frequency, year, month]);

  useEffect(() => {
    setPaymentsPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [paymentsGlobalFilter, data?.period?.start, data?.period?.end]);

  return (
    <>
      <Header fixed>
        <div className="ms-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro title="Billing" subtitle="Review balances and payments by house." />
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semi-annual">Every 6 Months</SelectItem>
                    <SelectItem value="annual">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" min={1970} max={9999} value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              {frequency === "monthly" && (
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                        <SelectItem key={m} value={m}>
                          {new Date(2000, Number(m) - 1, 1).toLocaleString(undefined, { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end text-sm text-muted-foreground">
                <div>
                  Rate: RM {data?.rate ?? 0} • Period: {periodLabel}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>House Payments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DataTableToolbar table={summaryTable} searchPlaceholder="Filter by house or status..." />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  {summaryTable.getHeaderGroups().map((headerGroup) => (
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
                  {summaryTable.getRowModel().rows.length ? (
                    summaryTable.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={summaryColumns.length} className="h-24 text-center text-muted-foreground">
                        No house payments found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={summaryTable} className="mt-auto" />
          </CardContent>
        </Card>

        <Card className={cn('max-sm:has-[div[role="toolbar"]]:mb-16')}>
          <CardHeader>
            <CardTitle>Payments Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DataTableToolbar table={paymentsTable} searchPlaceholder="Filter by date, house, or status..." />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  {paymentsTable.getHeaderGroups().map((headerGroup) => (
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
                  {paymentsTable.getRowModel().rows.length ? (
                    paymentsTable.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={paymentColumns.length} className="h-24 text-center text-muted-foreground">
                        No payment details found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={paymentsTable} className="mt-auto" />
          </CardContent>
        </Card>
      </Main>
    </>
  );
}
