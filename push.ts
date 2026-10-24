/**
 * Acesso ao OneSignal inicializado por pwa.js. As páginas usam este módulo em
 * vez de ler `window` diretamente.
 */

export interface OneSignalNamespace {
  login(externalId: string): Promise<void>;
  logout(): Promise<void>;
  Notifications: { requestPermission(): Promise<boolean> };
  User: { PushSubscription: { optedIn: boolean | null; optIn(): Promise<void>; optOut(): Promise<void> } };
}

interface WindowWithOneSignal {
  __feiraOneSignalReady?: Promise<OneSignalNamespace | null>;
}

/** Promessa resolvida quando o init termina (null se falhou ou expirou). */
export function oneSignalReady(): Promise<OneSignalNamespace | null> {
  const deferred = (window as WindowWithOneSignal).__feiraOneSignalReady;
  return deferred ?? Promise.resolve(null);
}

/** Como `oneSignalReady`, mas lança erro quando o serviço não carregou. */
export async function requireOneSignal(): Promise<OneSignalNamespace> {
  const oneSignal = await oneSignalReady();
  if (!oneSignal) {
    throw new Error("O serviço de notificações não carregou. Verifique a conexão e recarregue a página.");
  }
  return oneSignal;
}

/** Associa o dispositivo ao usuário (external_id). Falhas são registradas e não interrompem a página. */
export async function linkPushDeviceToUser(userId: string): Promise<void> {
  try {
    const oneSignal = await oneSignalReady();
    await oneSignal?.login(userId);
  } catch (error) {
    console.warn("Could not associate OneSignal with the account.", error);
  }
}
