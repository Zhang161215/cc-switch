import { isDevMode } from './config.js';

export function logInfo(message, data = null) {
  console.log(`[INFO] ${message}`);
  if (data && isDevMode()) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function logDebug(message, data = null) {
  if (isDevMode()) {
    console.log(`[DEBUG] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

export function logError(message, error = null) {
  console.error(`[ERROR] ${message}`);
  if (error) {
    if (isDevMode()) {
      console.error(error);
    } else {
      console.error(error.message || error);
    }
  }
}

export function logRequest(method, url, headers = null, body = null) {
  if (isDevMode()) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[REQUEST] ${method} ${url}`);
    if (headers) {
      console.log('[HEADERS]', JSON.stringify(headers, null, 2));
    }
    if (body) {
      console.log('[BODY]', JSON.stringify(body, null, 2));
    }
    console.log('='.repeat(80) + '\n');
  } else {
    console.log(`[REQUEST] ${method} ${url}`);
  }
}

export function logResponse(status, headers = null, body = null) {
  if (isDevMode()) {
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`[RESPONSE] Status: ${status}`);
    if (headers) {
      console.log('[HEADERS]', JSON.stringify(headers, null, 2));
    }
    if (body) {
      console.log('[BODY]', JSON.stringify(body, null, 2));
    }
    console.log('-'.repeat(80) + '\n');
  } else {
    console.log(`[RESPONSE] Status: ${status}`);
  }
}
