import PaystackPop from '@paystack/inline-js'
import { getPaystackKey } from '../config/paystack.js'

export const PAYSTACK_CALLBACK_URL = 'https://eventsnest.xyz/payment-success'

export function openPaystackPayment({ key, email, amount, reference, metadata, onSuccess, onClose }) {
  const resolvedKey = key || getPaystackKey()
  if (!resolvedKey) {
    console.error('Paystack public key missing. Check environment configuration.')
    return { ok: false, error: 'Paystack is not configured properly' }
  }

  const paystack = new PaystackPop()
  paystack.newTransaction({
    key: resolvedKey,
    email,
    amount,
    reference,
    metadata,
    callback_url: PAYSTACK_CALLBACK_URL,
    onSuccess,
    onCancel: onClose,
  })

  return { ok: true }
}
