import generatePayload from 'promptpay-qr';

export function generatePromptPayQR(
  promptpayId: string,
  amount: number
): string {
  return generatePayload(promptpayId, { amount });
}
