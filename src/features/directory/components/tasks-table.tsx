import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
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
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { houseTypes } from "../data/data";
import { type Task } from "../data/schema";
import { ResidentDialog } from "./resident-dialog";
import { ResidentDeleteDialog } from "./resident-delete-dialog";
// import { DataTableBulkActions } from './data-table-bulk-actions'
import { tasksColumns as columns } from "./tasks-columns";

const route = getRouteApi("/_authenticated/directory/");

type DataTableProps = {
  data?: Task[];
};

export function TasksTable({ data }: DataTableProps) {
  const queryClient = useQueryClient();
  // Local UI-only states
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // CRUD dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local state management for table (uncomment to use local-only state, not synced with URL)
  // const [globalFilter, onGlobalFilterChange] = useState('')
  // const [columnFilters, onColumnFiltersChange] = useState<ColumnFiltersState>([])
  // const [pagination, onPaginationChange] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  // Synced with URL states (updated to match route search schema defaults)
  const { globalFilter, onGlobalFilterChange, columnFilters, onColumnFiltersChange, pagination, onPaginationChange, ensurePageInRange } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: true, key: "filter" },
    columnFilters: [{ columnId: "houseType", searchKey: "houseType", type: "array" }],
  });

  const houseTypeFilter = (columnFilters.find((f) => (f as any).id === "houseType") as any)?.value as string[] | undefined;

  // CRUD mutations
  const createResidentMutation = useMutation({
    mutationFn: async (data: {
      houseNo: string;
      houseType: string;
      owners: Array<{ name: string; phone: string; userId?: string }>;
      vehicles: Array<{ brand: string; model: string; plate: string }>;
    }) => {
      const response = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create resident");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      toast.success("Resident created successfully");
      setDialogOpen(false);
      setSelectedResident(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateResidentMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        houseNo: string;
        houseType: string;
        owners: Array<{ name: string; phone: string; userId?: string }>;
        vehicles: Array<{ brand: string; model: string; plate: string }>;
      };
    }) => {
      const response = await fetch(`/api/residents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update resident");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      toast.success("Resident updated successfully");
      setDialogOpen(false);
      setSelectedResident(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteResidentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/residents/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete resident");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      toast.success("Resident deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedResident(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Event listeners for CRUD operations
  useEffect(() => {
    const handleEditResident = (event: CustomEvent) => {
      setSelectedResident(event.detail);
      setDialogOpen(true);
    };

    const handleDeleteResident = (event: CustomEvent) => {
      setSelectedResident(event.detail);
      setDeleteDialogOpen(true);
    };

    window.addEventListener("editResident", handleEditResident as EventListener);
    window.addEventListener("deleteResident", handleDeleteResident as EventListener);

    return () => {
      window.removeEventListener("editResident", handleEditResident as EventListener);
      window.removeEventListener("deleteResident", handleDeleteResident as EventListener);
    };
  }, []);

  const handleSubmit = async (data: {
    houseNo: string;
    houseType: string;
    owners: Array<{ name: string; phone: string; userId?: string }>;
    vehicles: Array<{ brand: string; model: string; plate: string }>;
  }) => {
    setIsSubmitting(true);
    try {
      if (selectedResident) {
        await updateResidentMutation.mutateAsync({ id: selectedResident.id, data });
      } else {
        await createResidentMutation.mutateAsync(data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedResident) {
      await deleteResidentMutation.mutateAsync(selectedResident.id);
    }
  };

  const {
    data: apiData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["residents", { page: pagination.pageIndex + 1, pageSize: pagination.pageSize, filter: globalFilter || "", houseType: houseTypeFilter || [] }],
    queryFn: async () => {
      const url = new URL("/api/residents", window.location.origin);
      url.searchParams.set("page", String(pagination.pageIndex + 1));
      url.searchParams.set("pageSize", String(pagination.pageSize));
      if (globalFilter) url.searchParams.set("filter", String(globalFilter));
      for (const ht of houseTypeFilter || []) url.searchParams.append("houseType", ht);

      const res = await fetch(url.toString());
      if (res.status === 204) return { data: [] as Task[], total: 0, pageSize: pagination.pageSize };
      if (!res.ok) throw new Error("Failed to load residents");
      const json = await res.json();
      return { data: (json.data as Task[]) ?? [], total: Number(json.total ?? 0), pageSize: Number(json.pageSize ?? pagination.pageSize) };
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
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row, _columnId, filterValue) => {
      const houseNo = String(row.getValue("houseNo")).toLowerCase();
      const owners = (row.original.owners || []).map((o) => o.name.toLowerCase());
      const vehicles = (row.original.vehicles || []).map((v) => v.plate.toLowerCase());
      const searchValue = String(filterValue).toLowerCase();
      return houseNo.includes(searchValue) || owners.some((n) => n.includes(searchValue)) || vehicles.some((v) => v.includes(searchValue));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: !!serverTotal,
    pageCount: computedPageCount,
  });

  const pageCount = table.getPageCount();
  useEffect(() => {
    ensurePageInRange(pageCount);
  }, [pageCount, ensurePageInRange]);

  return (
    <>
      <Card className={cn('max-sm:has-[div[role="toolbar"]]:mb-16', "flex flex-1 flex-col")}>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <DataTableToolbar
              table={table}
              searchPlaceholder="Filter by house no, owner name, or vehicle plate..."
              filters={[
                {
                  columnId: "houseType",
                  title: "House Type",
                  options: houseTypes,
                },
              ]}
            />
            <Button
              onClick={() => {
                setSelectedResident(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Resident
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan} className={cn(header.column.columnDef.meta?.className, header.column.columnDef.meta?.thClassName)}>
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
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.className, cell.column.columnDef.meta?.tdClassName)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      {isLoading && <div className="text-muted-foreground text-center py-4">Loading residents...</div>}
                      {error && <div className="text-destructive text-center py-4">{(error as Error).message}</div>}{" "}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} className="mt-auto" />
        </CardContent>
      </Card>
      <ResidentDialog open={dialogOpen} onOpenChange={setDialogOpen} resident={selectedResident} onSubmit={handleSubmit} isLoading={isSubmitting} />
      <ResidentDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        resident={selectedResident}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteResidentMutation.isPending}
      />
    </>
  );
}
