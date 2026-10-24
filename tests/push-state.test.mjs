import assert from "node:assert/strict";
import test from "node:test";

import { isDevicePushEnabled, pushFailureMessage, resolvePushUiState } from "../push-state.js";

test("push UI distinguishes devices and accounts", () => {
  const newAccount = resolvePushUiState({ deviceEnabled: false, accountEnabled: false, permissionDenied: false });
  assert.equal(newAccount.status, "Ainda não ativado");
  assert.equal(newAccount.enableLabel, "Ativar notificações");
  assert.equal(newAccount.showEnable, true);
  assert.equal(newAccount.showDisable, false);

  const otherDevice = resolvePushUiState({ deviceEnabled: false, accountEnabled: true, permissionDenied: false });
  assert.equal(otherDevice.status, "Ativado em outro dispositivo");
  assert.equal(otherDevice.enableLabel, "Ativar neste dispositivo");
  assert.equal(otherDevice.showEnable, true);
  assert.equal(otherDevice.showAccountContext, true);
  assert.equal(otherDevice.showDisable, false);

  const thisDevice = resolvePushUiState({ deviceEnabled: true, accountEnabled: true, permissionDenied: false });
  assert.equal(thisDevice.status, "Ativado neste dispositivo");
  assert.equal(thisDevice.showEnable, false);
  assert.equal(thisDevice.showDisable, true);
  assert.equal(thisDevice.showAccountContext, false);

  const blocked = resolvePushUiState({ deviceEnabled: false, accountEnabled: false, permissionDenied: true });
  assert.equal(blocked.status, "Bloqueado nas permissões do navegador");
  assert.equal(blocked.disableEnable, true);
  assert.equal(blocked.showPermissionHelp, true);
});

test("push errors produce actionable messages", () => {
  assert.match(pushFailureMessage(new Error("push service error")), /serviço de notificações|push/);
  assert.match(pushFailureMessage(new Error("NotAllowedError: Permission denied")), /permissão/);
  assert.match(pushFailureMessage(new Error("Não foi possível salvar este dispositivo para notificações.")), /salvar este dispositivo/);
  assert.match(pushFailureMessage(new Error("falha inesperada")), /Tente novamente/);
  assert.match(pushFailureMessage("falha inesperada"), /Tente novamente/);
});

test("push failures report their own cause instead of a generic alert", () => {
  assert.match(pushFailureMessage(new Error("Permissão não concedida.")), /aceite o aviso/);
  assert.match(pushFailureMessage(new Error("O navegador não ativou as notificações. Tente novamente.")), /confirmou a inscrição/);
  assert.match(pushFailureMessage(new Error("O serviço de notificações não carregou. Verifique a conexão e recarregue a página.")), /conexão/);
  assert.match(pushFailureMessage(new Error("falha inesperada")), /falha inesperada/);
});

test("device is enabled when the browser granted permission during activation", () => {
  assert.equal(isDevicePushEnabled({ permission: "granted", optedIn: true }), true);
  assert.equal(isDevicePushEnabled({ permission: "granted", optedIn: false, activatedNow: true }), true);
  assert.equal(isDevicePushEnabled({ permission: "default", optedIn: false, activatedNow: true }), false);
  assert.equal(isDevicePushEnabled({ permission: "granted", optedIn: false }), false);
  assert.equal(isDevicePushEnabled({ permission: "denied", optedIn: false, activatedNow: true }), false);
});
