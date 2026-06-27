import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
});

export function setApiKey(apiKey: string) {
  if (apiKey) {
    api.defaults.headers.common['x-api-key'] = apiKey;
  } else {
    delete api.defaults.headers.common['x-api-key'];
  }
}

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;
    if (Array.isArray(responseMessage)) {
      return responseMessage.join(', ');
    }
    if (typeof responseMessage === 'string') {
      return responseMessage;
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}
