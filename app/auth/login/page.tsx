"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === "SUPER_ADMIN") {
        router.push("/super-admin");
      } else if (user.role === "ADMIN") {
        router.push("/admin");
      } else if (user.role === "USER") {
        router.push("/user");
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  const handleRequestCode = async () => {
    if (!email) {
      setError("Please enter your email address.");
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");
    toast.loading("Sending OTP...", { id: "otp-request" });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "request", email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send code");
      }

      setInfo("Passcode sent to your email.");
      toast.success("OTP sent to your email!", { id: "otp-request" });
      setStep(2);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send code";
      setError(errorMessage);
      toast.error(errorMessage, { id: "otp-request" });
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("Email is required.");
      toast.error("Email is required.");
      return;
    }

    if (!code) {
      setError("Passcode is required.");
      toast.error("Passcode is required.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");
    toast.loading("Verifying OTP...", { id: "otp-validate" });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "validate", email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid code");
      }

      setInfo("Login successful!");
      toast.success("Login successful!", { id: "otp-validate" });

      await refreshUser();

      if (data.user?.role === "SUPER_ADMIN") {
        router.push("/super-admin");
      } else if (data.user?.role === "ADMIN") {
        router.push("/admin");
      } else if (data.user?.role === "USER") {
        router.push("/user");
      } else {
        router.push("/auth/login");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Invalid OTP!";
      setError(errorMessage);
      toast.error(errorMessage, { id: "otp-validate" });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardContent className="p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Login</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1
                ? "Enter your email to receive a passcode"
                : `Enter the passcode sent to ${email}`}
            </p>
          </div>

          <form
            onSubmit={
              step === 2
                ? handleValidateCode
                : (e) => {
                    e.preventDefault();
                    handleRequestCode();
                  }
            }>
            <FieldGroup className="space-y-4">
              {info && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {info}
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {step === 1 && (
                <>
                  <Field>
                    <FieldLabel htmlFor="email">Email Address</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="h-11"
                    />
                    <FieldDescription>
                      We'll send you a one-time passcode
                    </FieldDescription>
                  </Field>

                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={loading || !email}>
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Passcode
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  <Field>
                    <FieldLabel htmlFor="code">Passcode</FieldLabel>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      autoFocus
                      maxLength={6}
                      className="text-center text-2xl tracking-[0.3em] font-mono h-14"
                    />
                    <FieldDescription>
                      Enter the 6-digit code sent to your email
                    </FieldDescription>
                  </Field>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={() => {
                        setStep(1);
                        setCode("");
                        setError("");
                        setInfo("");
                      }}
                      disabled={loading}>
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-11"
                      disabled={loading || code.length !== 6}>
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Verifying...
                        </>
                      ) : (
                        <>
                          Login
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
