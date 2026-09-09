import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <LoginForm />
    </main>
  );
}
