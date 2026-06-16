import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";

const settingsSchema = z.object({
  radius: z.coerce.number().min(1, "Radius must be at least 1 meter"),
  timeWindow: z.coerce.number().min(0, "Time window cannot be negative"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const apiError = error.response?.data?.error;

    if (apiError === "forbidden" || status === 403) {
      return "You do not have permission to update check-in settings.";
    }

    if (status === 401) {
      return "You need to sign in again before managing check-in settings.";
    }

    if (typeof apiError === "string" && apiError.trim()) {
      return apiError;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function CheckInSettings() {
  const {
    auth: { accessToken },
  } = useAuthStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SettingsFormValues>({
    queryKey: ["check-in-settings"],
    queryFn: async () => {
      const res = await axios.get("/api/settings/check-in", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.data;
    },
    retry: false,
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: {
      radius: 50,
      timeWindow: 5,
    },
    values: settings ?? {
      radius: 50,
      timeWindow: 5,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      await axios.post("/api/settings/check-in", data, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-in-settings"] });
      toast.success("Settings updated", {
        description: "Check-in configuration has been saved.",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error("Error", {
        description: getApiErrorMessage(error, "Failed to update settings."),
      });
    },
  });

  function onSubmit(data: SettingsFormValues) {
    mutation.mutate(data);
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <Main className="flex flex-1 flex-col gap-4">
          <PageIntro title="Check-in Configuration" subtitle="Manage geofence radius and check-in interval settings." />
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Loading settings...
            </CardContent>
          </Card>
        </Main>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Header />
        <Main className="flex flex-1 flex-col gap-4">
          <PageIntro title="Check-in Configuration" subtitle="Manage geofence radius and check-in interval settings." />
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="font-medium text-destructive">Unable to load check-in settings</p>
                <p className="text-sm text-muted-foreground">
                  {getApiErrorMessage(error, "Failed to fetch settings.")}
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </Main>
      </>
    );
  }

  return (
    <>
      <Header />
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro title="Check-in Configuration" subtitle="Manage geofence radius and check-in interval settings." />
        <Card>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="radius"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Geofence Radius (meters)</FormLabel>
                      <FormControl>
                        <Input type="number" disabled={!isEditing} {...field} />
                      </FormControl>
                      <FormDescription>Maximum distance allowed from a checkpoint to check in.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timeWindow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check-in Interval (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" disabled={!isEditing} {...field} />
                      </FormControl>
                      <FormDescription>Minimum time required between check-ins at the same checkpoint.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-4">
                  {!isEditing ? (
                    <Button type="button" onClick={() => setIsEditing(true)}>
                      Edit Settings
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          form.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </Main>
    </>
  );
}
