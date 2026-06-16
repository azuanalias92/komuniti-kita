import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, X, Car, User as UserIcon } from "lucide-react";
import { type Task } from "../data/schema";
import type { User as AppUser } from "@/features/users/data/schema";
import { useAuthStore } from "@/stores/auth-store";

const ownerSchema = z.object({
  name: z.string().default(""),
  phone: z.string().default(""),
  userId: z.string().optional(),
});

const vehicleSchema = z.object({
  brand: z.string().default(""),
  model: z.string().default(""),
  plate: z.string().default(""),
});

const formSchema = z.object({
  houseNo: z.string().min(1, "House number is required"),
  houseType: z.enum(["own", "homestay"]),
  owners: z.array(ownerSchema),
  vehicles: z.array(vehicleSchema),
});

interface ResidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resident: Task | null;
  onSubmit: (data: z.infer<typeof formSchema>) => Promise<void>;
  isLoading?: boolean;
}

export function ResidentDialog({ open, onOpenChange, resident, onSubmit, isLoading }: ResidentDialogProps) {
  const [owners, setOwners] = useState<Array<{ name: string; phone: string; userId?: string }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ brand: string; model: string; plate: string }>>([]);
  const { data: userOptions } = useQuery({
    queryKey: ["users", { page: 1, pageSize: 100 }],
    queryFn: async () => {
      const url = new URL("/api/users", window.location.origin);
      url.searchParams.set("page", "1");
      url.searchParams.set("pageSize", "100");

      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.status === 204) return [] as AppUser[];
      const json = await res.json();
      return (json.data ?? []) as AppUser[];
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      houseNo: "",
      houseType: "own",
      owners: [],
      vehicles: [],
    },
  });

  useEffect(() => {
    if (resident) {
      form.reset({
        houseNo: resident.houseNo,
        houseType: resident.houseType,
        owners: resident.owners,
        vehicles: resident.vehicles,
      });
      // Use setTimeout to avoid setState in effect
      setTimeout(() => {
        setOwners(resident.owners);
        setVehicles(resident.vehicles);
      }, 0);
    } else {
      form.reset({
        houseNo: "",
        houseType: "own",
        owners: [],
        vehicles: [],
      });
      // Use setTimeout to avoid setState in effect
      setTimeout(() => {
        setOwners([]);
        setVehicles([]);
      }, 0);
    }
  }, [resident, form, open]);

  const handleAddOwner = () => {
    const newOwners = [...owners, { name: "", phone: "" }];
    setOwners(newOwners);
    form.setValue("owners", newOwners);
  };

  const handleRemoveOwner = (index: number) => {
    if (owners.length > 1) {
      const newOwners = owners.filter((_, i) => i !== index);
      setOwners(newOwners);
      form.setValue("owners", newOwners);
    }
  };

  const handleUpdateOwner = (index: number, field: "name" | "phone" | "userId", value: string) => {
    const newOwners = owners.map((owner: { name: string; phone: string; userId?: string }, i: number) => {
      if (i !== index) return owner;
      if (field === "userId") {
        const selected = (userOptions || []).find((u) => u.id === value);
        if (selected) {
          return { name: `${selected.firstName} ${selected.lastName}`.trim(), phone: selected.phoneNumber, userId: selected.id };
        }
        return { ...owner, userId: value };
      }
      return { ...owner, [field]: value };
    });
    setOwners(newOwners);
    form.setValue("owners", newOwners);
  };

  const handleAddVehicle = () => {
    const newVehicles = [...vehicles, { brand: "", model: "", plate: "" }];
    setVehicles(newVehicles);
    form.setValue("vehicles", newVehicles);
  };

  const handleRemoveVehicle = (index: number) => {
    const newVehicles = vehicles.filter((_, i) => i !== index);
    setVehicles(newVehicles);
    form.setValue("vehicles", newVehicles);
  };

  const handleUpdateVehicle = (index: number, field: "brand" | "model" | "plate", value: string) => {
    const newVehicles = vehicles.map((vehicle: { brand: string; model: string; plate: string }, i: number) => (i === index ? { ...vehicle, [field]: value } : vehicle));
    setVehicles(newVehicles);
    form.setValue("vehicles", newVehicles);
  };

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resident ? "Edit Resident" : "Add New Resident"}</DialogTitle>
          <DialogDescription>{resident ? "Update resident information" : "Add a new resident to the directory"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit as any)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField<z.infer<typeof formSchema>, "houseNo">
                control={form.control as any}
                name="houseNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>House Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., A-1-1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField<z.infer<typeof formSchema>, "houseType">
                control={form.control as any}
                name="houseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>House Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select house type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="own">Own</SelectItem>
                        <SelectItem value="homestay">Homestay</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Owners
                </h4>
                <Button type="button" variant="outline" size="sm" onClick={handleAddOwner}>
                  <Plus className="size-4" />
                  Add Owner
                </Button>
              </div>

              {owners.map((owner, index) => (
                <div key={index} className="grid grid-cols-3 gap-2 items-start">
                  {/* <div className="space-y-2 col-span-2">
                    <label className="text-sm text-muted-foreground">User</label>
                    <Select onValueChange={(val) => handleUpdateOwner(index, "userId", val)} defaultValue={owner.userId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Link user (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(userOptions || []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div> */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Name</Label>
                    <Input value={owner.name} onChange={(e) => handleUpdateOwner(index, "name", e.target.value)} placeholder="Owner name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Phone</Label>
                    <Input value={owner.phone} onChange={(e) => handleUpdateOwner(index, "phone", e.target.value)} placeholder="Phone number" />
                  </div>
                  <div className="flex items-start">
                    {owners.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOwner(index)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicles (Optional)
                </h4>
                <Button type="button" variant="outline" size="sm" onClick={handleAddVehicle}>
                  <Plus className="size-4" />
                  Add Vehicle
                </Button>
              </div>

              {vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles added</p>
              ) : (
                vehicles.map((vehicle, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 items-end">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Brand</Label>
                      <Input value={vehicle.brand} onChange={(e) => handleUpdateVehicle(index, "brand", e.target.value)} placeholder="e.g., Toyota" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Model</Label>
                      <Input value={vehicle.model} onChange={(e) => handleUpdateVehicle(index, "model", e.target.value)} placeholder="e.g., Camry" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Plate</Label>
                      <Input value={vehicle.plate} onChange={(e) => handleUpdateVehicle(index, "plate", e.target.value)} placeholder="e.g., ABC123" />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVehicle(index)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : resident ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
