export function getErrorMessage(err: any, fallback = 'An error occurred'): string {
  const errorData = err?.response?.data?.error;
  if (!errorData) return fallback;

  if (typeof errorData === 'string') {
    return errorData;
  }

  // Handle Zod flatten() error objects
  if (typeof errorData === 'object' && errorData !== null) {
    if (errorData.formErrors && Array.isArray(errorData.formErrors) && errorData.formErrors.length > 0) {
      return errorData.formErrors[0];
    }
    
    if (errorData.fieldErrors && typeof errorData.fieldErrors === 'object') {
      const fieldNames = Object.keys(errorData.fieldErrors);
      if (fieldNames.length > 0) {
        const firstField = fieldNames[0];
        const messages = errorData.fieldErrors[firstField];
        if (Array.isArray(messages) && messages.length > 0) {
          // e.g. "email: Invalid email"
          return `${firstField}: ${messages[0]}`;
        }
      }
    }
  }

  return fallback;
}
