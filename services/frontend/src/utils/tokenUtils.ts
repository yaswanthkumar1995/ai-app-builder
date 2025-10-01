// Debug utility to check token expiration
export const checkTokenExpiration = (token: string): { isExpired: boolean; expiresAt: Date | null; timeLeft: string } => {
  try {
    // Decode JWT token without verification (just to read the payload)
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(atob(base64Payload));
    
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
    const now = new Date();
    const isExpired = expiresAt ? now > expiresAt : false;
    
    let timeLeft = 'Unknown';
    if (expiresAt) {
      const timeDiff = expiresAt.getTime() - now.getTime();
      if (timeDiff > 0) {
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        timeLeft = `${hours}h ${minutes}m remaining`;
      } else {
        timeLeft = 'Expired';
      }
    }
    
    return { isExpired, expiresAt, timeLeft };
  } catch (error) {
    console.error('Error decoding token:', error);
    return { isExpired: true, expiresAt: null, timeLeft: 'Invalid token' };
  }
};

export const logTokenInfo = (token: string) => {
  const info = checkTokenExpiration(token);
  console.log('🔑 Token Info:', {
    isExpired: info.isExpired,
    expiresAt: info.expiresAt?.toISOString(),
    timeLeft: info.timeLeft
  });
  return info;
};