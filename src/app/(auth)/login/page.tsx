import { AuthForm } from "@/components/auth/auth-form";

/**
 * Pagina de inicio de sesion. (UC-1.2)
 * Renderiza el formulario de login en el centro de la pantalla.
 */
export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <AuthForm mode="login" />
    </div>
  );
}
