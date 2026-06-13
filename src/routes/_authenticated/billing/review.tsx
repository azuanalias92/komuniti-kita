import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeSwitch } from "@/components/theme-switch";
import { Search } from "@/components/search";
import { ConfigDrawer } from "@/components/config-drawer";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader, DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";

type Payment = { id: string; house_id: string; amount: number; receipt_key: string; payment_date: string; status: string };
type PaymentReviewRow = {
  id: string;
  houseId: string;
  houseNo: string;
  amount: number;
  receiptKey: string;
  paymentDate: string;
  status: string;
};

export const Route = createFileRoute("/_authenticated/billing/review")({
  component: PaymentReview,
});

function PaymentReview() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.auth.accessToken);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

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

  const { data, refetch, isFetching } = useQuery<Payment[]>({
    queryKey: ["billing:payments:pending"],
    queryFn: async () => {
      const res = await fetch("/api/billing/payments?status=pending");
      if (!res.ok) throw new Error("Failed to load payments");
      return await res.json();
    },
  });

  const { mutateAsync: updateStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "confirmed" | "rejected" }) => {
      const res = await fetch("/api/billing/payments", {
        method: "PUT",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Update failed");
      return await res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["billing:payments:pending"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  async function handleAction(id: string, status: "confirmed" | "rejected") {
    await updateStatus({ id, status });
    await refetch();
  }

  const rows = useMemo<PaymentReviewRow[]>(
    () =>
      (data || []).map((payment) => ({
        id: payment.id,
        houseId: payment.house_id,
        houseNo: residentMap.get(payment.house_id) || payment.house_id,
        amount: Number(payment.amount || 0),
        receiptKey: payment.receipt_key,
        paymentDate: payment.payment_date,
        status: payment.status,
      })),
    [data, residentMap]
  );

  const columns = useMemo<ColumnDef<PaymentReviewRow>[]>(
    () => [
      {
        accessorKey: "paymentDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
      },
      {
        accessorKey: "houseNo",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="House" />
        ),
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => Number(row.original.amount).toFixed(2),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
      },
      {
        accessorKey: "receiptKey",
        header: "Receipt",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.receiptKey ? (
            <a
              className="text-primary underline"
              href={`/api/r2/${row.original.receiptKey}`}
              target="_blank"
              rel="noreferrer"
            >
              View
            </a>
          ) : (
            "-"
          ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="space-x-2 text-right">
            <Button
              variant="default"
              size="sm"
              disabled={isFetching}
              onClick={() => handleAction(row.original.id, "confirmed")}
            >
              Accept
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isFetching}
              onClick={() => handleAction(row.original.id, "rejected")}
            >
              Reject
            </Button>
          </div>
        ),
      },
    ],
    [isFetching]
  );

  const table = useReactTable({
    data: rows,
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
        row.original.paymentDate.toLowerCase().includes(searchValue) ||
        row.original.houseNo.toLowerCase().includes(searchValue) ||
        row.original.status.toLowerCase().includes(searchValue)
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
  }, [globalFilter, data]);

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
        <PageIntro title="Payment Review" subtitle="Approve or reject submitted payments." />
        <Card className={cn('max-sm:has-[div[role="toolbar"]]:mb-16')}>
          <CardContent className="flex flex-col gap-4">
            <DataTableToolbar
              table={table}
              searchPlaceholder="Filter by date, house, or status..."
            />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
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
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No pending payments found.
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
