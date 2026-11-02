// Registra webhook, comandos do bot e (opcional) desativa polling.
import { pathToFileURL } from "node:url";
import {
  deleteTelegramWebhook,
  setTelegramCommands,
  setTelegramWebhook,
} from "./telegram-client.mjs";

const BOT_COMMANDS = [
  { command: "status", description: "Ver vínculo e alertas ativos" },
  { command: "pausar", description: "Pausar avisos de preço" },
  { command: "retomar", description: "Retomar avisos de preço" },
  { command: "desvincular", description: "Desconectar esta conta do Telegram" },
];

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !supabaseUrl || !webhookSecret) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN, SUPABASE_URL, or TELEGRAM_WEBHOOK_SECRET");
  }

  await setTelegramCommands(token, BOT_COMMANDS);

  if (process.argv.includes("--delete-webhook")) {
    await deleteTelegramWebhook(token);
    console.log("Telegram webhook removed (polling backup can run).");
    return;
  }

  const webhookUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telegram-webhook`;
  await setTelegramWebhook(token, webhookUrl, webhookSecret);
  console.log(`Telegram webhook set to ${webhookUrl}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
}
