import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function AuthPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({
        title: "Magic link sent",
        description: "Check your email for a magic link to log in.",
      });
    },
    onError: (error) => {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send magic link. Please try again.",
      });
    },
  });

  const devLoginMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/auth/dev-login", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Development login successful",
        description: "You have been logged in directly.",
      });
      // Refresh the page to trigger authentication check
      window.location.href = '/';
    },
    onError: (error) => {
      console.error("Dev login error:", error);
      toast({
        variant: "destructive",
        title: "Development login failed",
        description: "Failed to log in directly. Please try again.",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    loginMutation.mutate(data);
  };

  const onDevLogin = (data: z.infer<typeof formSchema>) => {
    devLoginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container grid grid-cols-1 md:grid-cols-2 gap-8 p-4 md:p-8 max-w-6xl">
        <div className="flex flex-col justify-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Welcome to TDRIPlanner</CardTitle>
              <CardDescription>
                Sign in to access your road asset management dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSent ? (
                <div className="space-y-4 text-center py-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-green-600">
                      <path d="M22 7.65c0-.52-.2-1.02-.57-1.39-.37-.37-.87-.57-1.4-.57H4c-.55 0-1.05.2-1.42.57-.37.37-.57.87-.57 1.4 0 .51.2 1.02.57 1.39.37.37.87.57 1.42.57h16c.53 0 1.03-.2 1.4-.58.37-.37.57-.87.57-1.39zm-8.5 11.73c-.16.14-.33.27-.5.27s-.34-.13-.45-.24L7.1 13.96a.62.62 0 0 1-.07-.85.6.6 0 0 1 .84-.07l4.6 4.01 4.6-4.01a.6.6 0 0 1 .84.07c.22.25.2.62-.03.85l-4.38 4.42z" fill="currentColor"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Check your email</h3>
                  <p className="text-sm text-gray-500">
                    We've sent a magic link to your email address. Click the link in the email to sign in.
                  </p>
                  <Button variant="outline" onClick={() => setEmailSent(false)}>
                    Try a different email
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="name@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-send-magic-link"
                    >
                      {loginMutation.isPending ? "Sending..." : "Send Magic Link"}
                    </Button>
                  </form>
                  
                  {/* Development login - only show in development */}
                  {import.meta.env.DEV && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-yellow-600 mb-2 text-center">
                        Development Mode: Quick Login
                      </p>
                      <Button
                        onClick={() => onDevLogin(form.getValues())}
                        variant="outline"
                        className="w-full"
                        disabled={devLoginMutation.isPending || !form.getValues().email}
                        data-testid="button-dev-login"
                      >
                        {devLoginMutation.isPending ? "Logging in..." : "Dev Login (Skip Magic Link)"}
                      </Button>
                    </div>
                  )}
                </Form>
              )}
            </CardContent>
            <CardFooter className="flex justify-center border-t pt-4">
              <p className="text-xs text-gray-500">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </CardFooter>
          </Card>
        </div>
        <div className="hidden md:flex flex-col justify-center">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                Smart Road Asset Management
              </span>
            </h1>
            <p className="text-xl text-gray-600">
              TDRIPlanner helps road asset managers monitor, plan, and predict the current and future state of pavements.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Secure Multi-Tenant Platform</h3>
                  <p className="text-sm text-gray-500">Manage assets across multiple organizations securely</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Real-time Monitoring</h3>
                  <p className="text-sm text-gray-500">Track moisture, condition, and asset health</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Advanced Analytics</h3>
                  <p className="text-sm text-gray-500">Predictive deterioration models using ML</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600">
                    <path d="M3 3v18h18"></path>
                    <path d="m19 9-5 5-4-4-3 3"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Budgeting Tools</h3>
                  <p className="text-sm text-gray-500">Optimize maintenance with intelligent budget planning</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}