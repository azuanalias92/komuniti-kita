import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { useAuthStore } from "@/stores/auth-store";
import { useTenantStore } from "@/stores/tenant-store";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
  invitesCount: number;
  pendingApprovalsCount: number;
};

const createTenantSchema = z.object({
  name: z.string().min(2, "Enter tenant name"),
  slug: z.string(),
});

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function Tenants() {
  const { auth } = useAuthStore();
  const isSuperAdmin = auth.user?.role.includes("super_admin") ?? false;
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const form = useForm<z.infer<typeof createTenantSchema>>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: "", slug: "" },
  });

  async function loadTenants() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenants");
      const json = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(json.error || "Failed to load tenants");
      }
      setTenants(Array.isArray(json) ? json : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tenants");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [globalFilter]);

  function handleDialogOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEditingTenant(null);
      form.reset({ name: "", slug: "" });
    }
  }

  function handleCreateOpen() {
    setEditingTenant(null);
    form.reset({ name: "", slug: "" });
    setOpen(true);
  }

  function handleEditOpen(tenant: Tenant) {
    setEditingTenant(tenant);
    form.reset({ name: tenant.name, slug: tenant.slug });
    setOpen(true);
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }: { row: { original: Tenant } }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "slug",
        header: "Slug",
      },
      {
        accessorKey: "usersCount",
        header: "Users",
      },
      {
        accessorKey: "invitesCount",
        header: "Active Invites",
      },
      {
        accessorKey: "pendingApprovalsCount",
        header: "Pending Approvals",
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }: { row: { original: Tenant } }) => formatDate(row.original.createdAt),
      },
      ...(isSuperAdmin
        ? [
            {
              id: "actions",
              header: () => <div className="text-right">Actions</div>,
              enableSorting: false,
              enableHiding: false,
              cell: ({ row }: { row: { original: Tenant } }) => (
                <div className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleEditOpen(row.original)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [isSuperAdmin],
  );

  const table = useReactTable({
    data: tenants,
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

      const tenant = row.original;
      return tenant.name.toLowerCase().includes(searchValue) || tenant.slug.toLowerCase().includes(searchValue);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  async function onSubmit(values: z.infer<typeof createTenantSchema>) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tenants", {
        method: editingTenant ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingTenant ? { id: editingTenant.id, ...values } : values),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.error === "slug_exists") {
          throw new Error("Slug already exists. Please use a different slug.");
        }
        if (json.error === "tenant_not_found") {
          throw new Error("Tenant not found.");
        }
        throw new Error(json.error || "Failed to create tenant");
      }
      if (editingTenant) {
        setTenants((current) => current.map((tenant) => (tenant.id === editingTenant.id ? (json as Tenant) : tenant)));
        useTenantStore.getState().addTenant({ id: json.id, name: json.name, slug: json.slug });
        toast.success("Tenant updated");
      } else {
        setTenants((current) => [json as Tenant, ...current]);
        useTenantStore.getState().addTenant({ id: json.id, name: json.name, slug: json.slug });
        toast.success("Tenant created");
      }
      setEditingTenant(null);
      form.reset({ name: "", slug: "" });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : editingTenant ? "Failed to update tenant" : "Failed to create tenant");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro title="Tenants" subtitle="View, create, and update communities." />
        <Card className={cn('max-sm:has-[div[role="toolbar"]]:mb-16', "flex flex-1 flex-col")}>
          <CardContent className="flex flex-1 flex-col gap-4">
            <DataTableToolbar
              table={table}
              searchPlaceholder="Filter by tenant name or slug..."
              actions={
                isSuperAdmin
                  ? [
                      {
                        label: "Add Tenant",
                        onClick: handleCreateOpen,
                      },
                    ]
                  : []
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
                        {loading ? "Loading tenants..." : "No tenants found yet."}
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
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTenant ? "Edit Tenant" : "Create Tenant"}</DialogTitle>
            <DialogDescription>
              {editingTenant ? "Update the tenant name and slug." : "Add a new community tenant. Leave slug empty to auto-generate it from the name."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Taman Seri Mewah" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="optional, e.g. taman-seri-mewah" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (editingTenant ? "Saving..." : "Creating...") : editingTenant ? "Save Changes" : "Create Tenant"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
