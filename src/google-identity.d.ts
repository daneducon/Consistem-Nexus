type GoogleCredentialResponse = {
  credential: string;
};

type GoogleIdentityId = {
  initialize(options: { client_id: string; callback(response: GoogleCredentialResponse): void }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number | boolean>): void;
  disableAutoSelect(): void;
};

interface Window {
  google?: {
    accounts: {
      id: GoogleIdentityId;
    };
  };
}
