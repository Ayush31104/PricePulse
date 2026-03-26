// utils/ApiResponse.js
// Standardised response format for successful API responses.

// Flexible signature supported for backwards compatibility:
// 1) sendSuccess(res, data, message = 'Success', statusCode = 200, meta = null)
// 2) sendSuccess(res, statusCode, message, data, meta = null)
export const sendSuccess = (
  res,
  arg2 = 200,
  arg3 = 'Success',
  arg4 = null,
  arg5 = null
) => {
  let statusCode;
  let message;
  let data;
  let meta;

  if (typeof arg2 === 'number') {
    // Backwards-compatible style: sendSuccess(res, statusCode, message, data, meta)
    statusCode = arg2;
    message = arg3;
    data = arg4;
    meta = arg5;
  } else {
    // Preferred style: sendSuccess(res, data, message, statusCode, meta)
    data = arg2;
    message = typeof arg3 === 'string' ? arg3 : 'Success';
    statusCode = typeof arg4 === 'number' ? arg4 : 200;
    meta = arg5;
  }

  const response = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  if (meta !== null && meta !== undefined) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

export const sendCreated = (res, data, message = 'Resource created successfully') => {
  return sendSuccess(res, data, message, 201);
};

export const sendNoContent = (res) => {
  return res.status(204).send();
};