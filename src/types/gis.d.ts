// src/types/gis.d.ts
// Dichiarazioni minimali per Google Identity Services (GIS).
// Caricato via <script> in index.html — non c'è un pacchetto @types ufficiale
// stabile, quindi dichiariamo solo le API che usiamo.

declare global {
  interface GisTokenResponse {
    access_token:        string;
    expires_in:          string;   // secondi come stringa
    token_type:          string;
    scope:               string;
    error?:              string;
    error_description?:  string;
  }

  interface GisTokenClient {
    requestAccessToken(overrideConfig?: { prompt?: string }): void;
  }

  interface GisTokenClientConfig {
    client_id:       string;
    scope:           string;
    callback:        (resp: GisTokenResponse) => void;
    error_callback?: (err: { type: string }) => void;
  }

  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: GisTokenClientConfig): GisTokenClient;
          revoke(token: string, callback: () => void): void;
        };
      };
    };
  }
}

export {};
