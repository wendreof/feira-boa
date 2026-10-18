import { deleteAccount, errorMessage, getCurrentUser, signOut } from "./account";

const email = document.querySelector<HTMLElement>("#account-email")!;
const status = document.querySelector<HTMLParagraphElement>("#account-status")!;
const signOutButton = document.querySelector<HTMLButtonElement>("#sign-out")!;
const deleteAccountButton = document.querySelector<HTMLButtonElement>("#delete-account")!;

function setStatus(message: string): void {
  status.textContent = message;
}

function setActionsDisabled(disabled: boolean): void {
  signOutButton.disabled = disabled;
  deleteAccountButton.disabled = disabled;
}

signOutButton.addEventListener("click", async () => {
  setActionsDisabled(true);
  setStatus("Saindo…");

  try {
    await signOut();
    window.location.replace("index.html");
  } catch (error) {
    setStatus(`Não foi possível sair: ${errorMessage(error)}`);
    setActionsDisabled(false);
  }
});

deleteAccountButton.addEventListener("click", async () => {
  if (!window.confirm("Excluir sua conta e os dados sincronizados? Esta ação não pode ser desfeita.")) return;

  setActionsDisabled(true);
  setStatus("Excluindo conta…");

  try {
    await deleteAccount();
    window.location.replace("index.html");
  } catch (error) {
    setStatus(`Não foi possível excluir a conta: ${errorMessage(error)}`);
    setActionsDisabled(false);
  }
});

void getCurrentUser()
  .then((user) => {
    if (!user) {
      window.location.replace("login.html?returnTo=account.html");
      return;
    }
    email.textContent = user.email ?? "E-mail não disponível";
    setStatus("Seus favoritos estão sincronizados.");
  })
  .catch((error: unknown) => {
    email.textContent = "Não foi possível verificar sua sessão";
    setStatus(`Tente novamente: ${errorMessage(error)}`);
    setActionsDisabled(true);
  });
