export type OAuthLoginProvider = "google" | "facebook" | "x";

export const OAUTH_PROVIDER_LABELS: Record<OAuthLoginProvider, string> = {
  google: "Google",
  facebook: "Facebook",
  x: "X",
};

/** Extra OAuth scopes per provider (only when Supabase defaults are not enough). */
export const OAUTH_PROVIDER_SCOPES: Partial<Record<OAuthLoginProvider, string>> = {
  facebook: "public_profile,email",
};

/** Callback URL Supabase receives after the user finishes OAuth at the provider. */
export function buildOAuthLoginRedirect(origin: string, returnTo: string): string {
  const redirectTo = new URL("login.html", origin);
  redirectTo.searchParams.set("returnTo", returnTo);
  return redirectTo.toString();
}

/** User-facing copy when Supabase redirects back with ?error_description=… */
export function oauthCallbackErrorUserMessage(errorDescription: string): string {
  const text = errorDescription.trim();
  if (/profile from external provider/i.test(text)) {
    return (
      "O provedor autorizou, mas o Supabase não conseguiu ler o perfil. " +
      "Confira Authentication → Logs no Supabase. Enquanto isso, use Google ou e-mail/senha."
    );
  }
  if (/email from external provider/i.test(text)) {
    return (
      "O provedor não enviou um e-mail utilizável. No app X, ative “Request email from users” e tente de novo, ou use Google / e-mail e senha."
    );
  }
  return `Não foi possível concluir o login social: ${text}`;
}

export function oauthProviderUnavailableUserMessage(provider: OAuthLoginProvider, rawMessage: string): string {
  const label = OAUTH_PROVIDER_LABELS[provider];
  if (/provider|not enabled|not configured/i.test(rawMessage)) {
    return `O login com ${label} ainda não está disponível. Use seu e-mail e senha.`;
  }
  return `Não foi possível entrar com ${label}: ${rawMessage}`;
}