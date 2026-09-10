import { AuthForm } from "@/components/auth/auth-form";

/**
 * Pagina de registro de cuenta. (UC-1.1)
 * Renderiza el formulario de registro en el centro de la pantalla.
 */
export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <AuthForm mode="register" />
    </div>
  );
}
