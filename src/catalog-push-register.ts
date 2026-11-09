import { supabase } from "./supabase-client";

function subscriptionKeys(subscription: PushSubscription): { endpoint: string; p256dh: string; auth_key: string } | null {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth_key: json.keys.auth,
  };
}

export async function registerAnonymousCatalogPush(subscription: PushSubscription): Promise<void> {
  const keys = subscriptionKeys(subscription);
  if (!keys) throw new Error("O navegador não forneceu os dados completos da inscrição.");
  const { error } = await supabase.rpc("register_anonymous_push_subscription", {
    p_endpoint: keys.endpoint,
    p_p256dh: keys.p256dh,
    p_auth_key: keys.auth_key,
  });
  if (error) throw error;
}

export async function unregisterAnonymousCatalogPush(subscription: PushSubscription): Promise<void> {
  const keys = subscriptionKeys(subscription);
  if (!keys) return;
  const { error } = await supabase.rpc("unregister_anonymous_push_subscription", {
    p_endpoint: keys.endpoint,
  });
  if (error) console.warn("Could not remove anonymous push registration.", error);
}
