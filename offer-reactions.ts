import { supabase } from "./supabase-client";

export type OfferReaction = "like" | "dislike";

export interface OfferReactionCounts {
  likes: number;
  dislikes: number;
}

export async function loadOfferReactionCounts(): Promise<Map<string, OfferReactionCounts>> {
  const { data, error } = await supabase.rpc("get_offer_reaction_counts");
  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.offer_id, { likes: row.likes, dislikes: row.dislikes }]));
}

export async function loadUserOfferReactions(userId: string): Promise<Map<string, OfferReaction>> {
  const { data, error } = await supabase
    .from("offer_reactions")
    .select("offer_id, reaction")
    .eq("user_id", userId);
  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.offer_id, row.reaction]));
}

export async function saveOfferReaction(userId: string, offerId: string, reaction: OfferReaction): Promise<void> {
  const { error } = await supabase
    .from("offer_reactions")
    .upsert({ user_id: userId, offer_id: offerId, reaction }, { onConflict: "user_id,offer_id" });
  if (error) throw error;
}

export async function deleteOfferReaction(userId: string, offerId: string): Promise<void> {
  const { error } = await supabase
    .from("offer_reactions")
    .delete()
    .eq("user_id", userId)
    .eq("offer_id", offerId);
  if (error) throw error;
}
