import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useAclStore } from "@/stores/acl-store";
import { Header } from "@/components/layout/header";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Separator } from "@radix-ui/react-separator";
import { Main } from "@/components/layout/main";

const roleSchema = z.object({
  name: z.string().min(2, "Enter role name"),
  description: z.string().optional().catch(""),
  startPage: z.string().optional().catch(""),
});

type Crud = { create: boolean; read: boolean; update: boolean; delete: boolean };

function resourceList() {
  return ["/", "/roles", "/users", "/tenants", "/checkpoints", "/check-in", "/check-in-logs", "/directory", "/homestay", "/settings"];
}

export function Roles() {
  const [roles, setRoles] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedRole, setSelectedRole] = useState<{ id: string; name: string } | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Crud>>({});
  const [editingRole, setEditingRole] = useState<{ name: string; description: string; startPage: string }>({ name: "", description: "", startPage: "" });
  const acl = useAclStore();

  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/roles");
      const list = await res.json();
      setRoles(list);
      if (list.length > 0 && !selectedRole) {
        setSelectedRole({ id: list[0].id, name: list[0].name });
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    (async () => {
      const res = await fetch(`/api/roles/${selectedRole.id}`);
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
    })();
  }, [selectedRole?.id]);

  const resources = useMemo(() => resourceList(), []);

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
    setRoles((list) => list.map((r) => (r.id === selectedRole.id ? { id: r.id, name: String(updated.name || editingRole.name), description: String(updated.description || editingRole.description) } : r)));
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
      <Main>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Roles</h1>
          <p className="text-muted-foreground">Manage your roles and set permissions.</p>
        </div>
        <Separator className="my-4 lg:my-6" />
        <div className="flex flex-1 min-h-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex-1 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Description</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3}>No roles yet. Create one on the right.</TableCell>
                        </TableRow>
                      ) : (
                        roles.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="sticky left-0 bg-background">{r.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">{r.description}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => setSelectedRole({ id: r.id, name: r.name })}>
                                Edit ACL
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="w-full lg:w-[360px]">
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
              <CardContent className="flex-1 min-h-0">
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <Input
                    value={editingRole.name}
                    onChange={(e) => setEditingRole((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Role name"
                  />
                  <Input
                    value={editingRole.description}
                    onChange={(e) => setEditingRole((s) => ({ ...s, description: e.target.value }))}
                    placeholder="Description"
                  />
                  <Input
                    value={editingRole.startPage}
                    onChange={(e) => setEditingRole((s) => ({ ...s, startPage: e.target.value }))}
                    placeholder="Starting page e.g. /dashboard"
                  />
                  <div className="sm:col-span-3">
                    <Button variant="outline" onClick={onSaveRoleInfo}>Save Role</Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Resource</TableHead>
                      <TableHead>Create</TableHead>
                      <TableHead>Read</TableHead>
                      <TableHead>Update</TableHead>
                      <TableHead>Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resources.map((r) => (
                      <TableRow key={r}>
                        <TableCell className="sticky left-0 bg-background">{r}</TableCell>
                        <TableCell>
                          <Checkbox className="h-5 w-5" checked={!!matrix[r]?.create} onCheckedChange={() => toggle(r, "create")} />
                        </TableCell>
                        <TableCell>
                          <Checkbox className="h-5 w-5" checked={!!matrix[r]?.read} onCheckedChange={() => toggle(r, "read")} />
                        </TableCell>
                        <TableCell>
                          <Checkbox className="h-5 w-5" checked={!!matrix[r]?.update} onCheckedChange={() => toggle(r, "update")} />
                        </TableCell>
                        <TableCell>
                          <Checkbox className="h-5 w-5" checked={!!matrix[r]?.delete} onCheckedChange={() => toggle(r, "delete")} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4">
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
