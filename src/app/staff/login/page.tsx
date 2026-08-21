import { Suspense } from "react";
import { LoginForm } from "@/components/staff/LoginForm";

const restaurantName = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "Chil Terrace";

export default function StaffLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="text-center">
        <p className="text-sm font-medium text-muted">{restaurantName}</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">スタッフログイン</h1>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
