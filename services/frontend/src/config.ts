// Global configuration interface
declare global {
  interface Window {
    APP_CONFIG: {
      API_GATEWAY_URL: string;
      WS_URL: string;
    };
  }
}

// Configuration utility
export const config = {
  get apiGatewayUrl(): string {
    return window.APP_CONFIG?.API_GATEWAY_URL || 'http://localhost:8000';
  },
  get wsUrl(): string {
    return window.APP_CONFIG?.WS_URL || 'ws://localhost:8000';
  }
};
