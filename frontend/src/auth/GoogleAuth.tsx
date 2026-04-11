const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

declare global {
  interface Window {
    google: any;
  }
}

function waitForGoogle(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Google Identity Services failed to load"));
      }
    }, 50);
  });
}

export async function initGoogleAuth(
  onCredential: (credential: string) => void
) {
  await waitForGoogle();
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response: { credential: string }) => {
      onCredential(response.credential);
    },
  });
}

export async function promptGoogleSignIn() {
  await waitForGoogle();
  window.google.accounts.id.prompt();
}

export async function renderGoogleButton(element: HTMLElement) {
  await waitForGoogle();
  window.google.accounts.id.renderButton(element, {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
  });
}
