import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DataTableColumnHeader, DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { toast } from "sonner";
import { useAclStore } from "@/stores/acl-store";
import { Header } from "@/components/layout/header";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";

const roleSchema = z.object({
  name: z.string().min(2, "Enter role name"),
  description: z.string().optional().catch(""),
  startPage: z.string().optional().catch(""),
});

type Crud = { create: boolean; read: boolean; update: boolean; delete: boolean };
type RoleRow = { id: string; name: string; description: string };
type AclRow = { resource: string; create: boolean; read: boolean; update: boolean; delete: boolean };

function resourceList() {
  return ["/", "/roles", "/users", "/tenants", "/checkpoints", "/check-in", "/check-in-logs", "/directory", "/homestay", "/settings"];
}

export function Roles() {
  const [roles, setRoles] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedRole, setSelectedRole] = useState<{ id: string; name: string } | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Crud>>({});
  const [editingRole, setEditingRole] = useState<{ name: string; description: string; startPage: string }>({ name: "", description: "", startPage: "" });
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const [roleTableSorting, setRoleTableSorting] = useState<SortingState>([]);
  const [roleTableVisibility, setRoleTableVisibility] = useState<VisibilityState>({});
  const [roleTablePagination, setRoleTablePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [aclTableSorting, setAclTableSorting] = useState<SortingState>([]);
  const [aclTableVisibility, setAclTableVisibility] = useState<VisibilityState>({});
  const [aclTablePagination, setAclTablePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const acl = useAclStore();

  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", description: "", startPage: "" },
  });

  useEffect(() => {
    (async () => {
      try {
        setRolesLoading(true);
        setRolesError("");
        const res = await fetch("/api/roles");
        if (!res.ok) {
          throw new Error("Failed to load roles");
        }
        const list = (await res.json()) as RoleRow[];
        setRoles(list);
        if (list.length > 0 && !selectedRole) {
          setSelectedRole({ id: list[0].id, name: list[0].name });
        }
      } catch (error) {
        setRolesError(error instanceof Error ? error.message : "Failed to load roles");
      } finally {
        setRolesLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    (async () => {
      try {
        const res = await fetch(`/api/roles/${selectedRole.id}`);
        if (!res.ok) return;
        const json = await res.json();
        setEditingRole({
          name: String(json.role?.name || selectedRole.name || ""),
          description: String(json.role?.description || ""),
          startPage: String(json.role?.start_page || ""),
        });
        const m: Record<string, Crud> = {};
        for (const r of resourceList()) {
          m[r] = { create: false, read: true, update: false, delete: false };
        }
        for (const p of json.permissions || []) {
          const r = String(p.resource);
          if (!m[r]) m[r] = { create: false, read: false, update: false, delete: false };
          m[r] = {
            create: Number(p.can_create || 0) === 1,
            read: Number(p.can_read || 0) === 1,
            update: Number(p.can_update || 0) === 1,
            delete: Number(p.can_delete || 0) === 1,
          };
        }
        setMatrix(m);
      } catch {}
    })();
  }, [selectedRole?.id]);

  const resources = useMemo(() => resourceList(), []);
  const aclRows = useMemo<AclRow[]>(
    () =>
      resources.map((resource) => ({
        resource,
        create: !!matrix[resource]?.create,
        read: !!matrix[resource]?.read,
        update: !!matrix[resource]?.update,
        delete: !!matrix[resource]?.delete,
      })),
    [matrix, resources],
  );

  const roleColumns = useMemo<ColumnDef<RoleRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
        enableHiding: false,
      },
      {
        accessorKey: "description",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
        cell: ({ row }) => <div>{row.original.description || "-"}</div>,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setSelectedRole({ id: row.original.id, name: row.original.name })}>
              Edit ACL
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [],
  );

  const aclColumns = useMemo<ColumnDef<AclRow>[]>(
    () => [
      {
        accessorKey: "resource",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
        cell: ({ row }) => <div className="font-medium">{row.original.resource}</div>,
        enableHiding: false,
      },
      {
        accessorKey: "create",
        header: () => <div className="text-center">Create</div>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Checkbox className="h-5 w-5" checked={row.original.create} onCheckedChange={() => toggle(row.original.resource, "create")} />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "read",
        header: () => <div className="text-center">Read</div>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Checkbox className="h-5 w-5" checked={row.original.read} onCheckedChange={() => toggle(row.original.resource, "read")} />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "update",
        header: () => <div className="text-center">Update</div>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Checkbox className="h-5 w-5" checked={row.original.update} onCheckedChange={() => toggle(row.original.resource, "update")} />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "delete",
        header: () => <div className="text-center">Delete</div>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Checkbox className="h-5 w-5" checked={row.original.delete} onCheckedChange={() => toggle(row.original.resource, "delete")} />
          </div>
        ),
        enableSorting: false,
      },
    ],
    [matrix],
  );

  const rolesTable = useReactTable({
    data: roles,
    columns: roleColumns,
    state: {
      sorting: roleTableSorting,
      columnVisibility: roleTableVisibility,
      pagination: roleTablePagination,
    },
    onSortingChange: setRoleTableSorting,
    onColumnVisibilityChange: setRoleTableVisibility,
    onPaginationChange: setRoleTablePagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const aclTable = useReactTable({
    data: aclRows,
    columns: aclColumns,
    state: {
      sorting: aclTableSorting,
      columnVisibility: aclTableVisibility,
      pagination: aclTablePagination,
    },
    onSortingChange: setAclTableSorting,
    onColumnVisibilityChange: setAclTableVisibility,
    onPaginationChange: setAclTablePagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  async function onCreateRole(data: z.infer<typeof roleSchema>) {
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: data.name, description: data.description, startPage: data.startPage }),
    });
    if (!res.ok) {
      toast.error("Failed to create role");
      return;
    }
    const role = await res.json();
    setRoles((r) => [...r, role]);
    setSelectedRole({ id: role.id, name: role.name });
    form.reset({ name: "", description: "", startPage: "" });
    toast.success("Role created");
  }

  async function onSaveAcl() {
    if (!selectedRole) return;
    const payload = {
      role: selectedRole.name,
      permissions: Object.entries(matrix).map(([resource, p]) => ({
        resource,
        create: p.create,
        read: p.read,
        update: p.update,
        delete: p.delete,
      })),
    };
    const res = await fetch("/api/acl", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Failed to save ACL");
      return;
    }
    if (acl.role === selectedRole.name) {
      await acl.loadForRole(selectedRole.name);
    }
    toast.success("ACL saved");
  }

  function toggle(resource: string, key: keyof Crud) {
    setMatrix((m) => ({ ...m, [resource]: { ...m[resource], [key]: !m[resource]?.[key] } }));
  }

  function tickAll() {
    setMatrix((m) => {
      const next: Record<string, Crud> = { ...m };
      for (const r of resources) {
        next[r] = { create: true, read: true, update: true, delete: true };
      }
      return next;
    });
  }

  async function onSaveRoleInfo() {
    if (!selectedRole) return;
    if (!editingRole.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const res = await fetch(`/api/roles/${selectedRole.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: editingRole.name.trim(), description: editingRole.description, startPage: editingRole.startPage }),
    });
    if (!res.ok) {
      toast.error("Failed to update role");
      return;
    }
    const updated = await res.json();
    setRoles((list) =>
      list.map((r) =>
        r.id === selectedRole.id ? { id: r.id, name: String(updated.name || editingRole.name), description: String(updated.description || editingRole.description) } : r,
      ),
    );
    setSelectedRole({ id: selectedRole.id, name: editingRole.name.trim() });
    if (acl.role === updated.name || acl.role === editingRole.name.trim()) {
      await acl.loadForRole(editingRole.name.trim());
    }
    toast.success("Role updated");
  }

  return (
    <>
      <Header>
        <div className="ms-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro title="Roles" subtitle="Manage roles and access permissions." />
        <div className="flex flex-1 min-h-0 flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <DataTableToolbar table={rolesTable} searchPlaceholder="Filter roles..." searchKey="name" />
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    {rolesTable.getHeaderGroups().map((headerGroup) => (
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
                    {rolesLoading ? (
                      <TableRow>
                        <TableCell colSpan={roleColumns.length} className="h-24 text-center">
                          Loading roles...
                        </TableCell>
                      </TableRow>
                    ) : rolesError ? (
                      <TableRow>
                        <TableCell colSpan={roleColumns.length} className="h-24 text-center text-destructive">
                          {rolesError}
                        </TableCell>
                      </TableRow>
                    ) : rolesTable.getRowModel().rows.length ? (
                      rolesTable.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={roleColumns.length} className="h-24 text-center">
                          No roles yet. Create one below.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination table={rolesTable} className="mt-auto" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="w-full lg:w-90">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onCreateRole)} className="grid gap-3">
                    <FormField
                      name="name"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. manager" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="description"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input placeholder="optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="startPage"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Starting Page</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. /dashboard or /check-in" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit">Create Role</Button>
                  </form>
                </Form>
              </div>
            </CardContent>
          </Card>

          {selectedRole && (
            <Card className="flex flex-1 min-h-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>ACL: {selectedRole.name}</CardTitle>
                  <Button variant="outline" onClick={tickAll}>
                    Tick All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 min-h-0 flex-col gap-4">
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <Input value={editingRole.name} onChange={(e) => setEditingRole((s) => ({ ...s, name: e.target.value }))} placeholder="Role name" />
                  <Input value={editingRole.description} onChange={(e) => setEditingRole((s) => ({ ...s, description: e.target.value }))} placeholder="Description" />
                  <Input value={editingRole.startPage} onChange={(e) => setEditingRole((s) => ({ ...s, startPage: e.target.value }))} placeholder="Starting page e.g. /dashboard" />
                  <div className="sm:col-span-3">
                    <Button variant="outline" onClick={onSaveRoleInfo}>
                      Save Role
                    </Button>
                  </div>
                </div>
                <DataTableToolbar table={aclTable} searchPlaceholder="Filter resources..." searchKey="resource" />
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      {aclTable.getHeaderGroups().map((headerGroup) => (
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
                      {aclTable.getRowModel().rows.length ? (
                        aclTable.getRowModel().rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={aclColumns.length} className="h-24 text-center">
                            No resources found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <DataTablePagination table={aclTable} className="mt-auto" />
                <div>
                  <Button onClick={onSaveAcl}>Save ACL</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Main>
    </>
  );
}
