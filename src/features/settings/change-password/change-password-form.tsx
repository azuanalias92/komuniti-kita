import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

const formSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(7, "Password must be at least 7 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

export function ChangePasswordForm() {
  const { auth } = useAuthStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

  const onSubmit = async (data: FormValues) => {
    const email = auth.user?.email || "";
    if (!email) {
      toast.error("Not logged in");
      return;
    }
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Password updated");
      form.reset();
    } catch {
      toast.error("Failed to update password");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </form>
    </Form>
  );
}
