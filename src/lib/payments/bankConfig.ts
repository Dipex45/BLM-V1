import { BankAccountConfig } from './types';

export const DEFAULT_BANK_CONFIG: BankAccountConfig = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  branchName: '',
  currency: 'NGN',
  instructions: 'Transfer the exact amount and use your unique BLM payment reference as the transaction narration.',
  deadlineHours: 24,
  contactPhone: '+2349064090276',
  contactEmail: 'bookings@blmmotors.ng',
  referencePrefix: 'BLM',
  requireProofUpload: true,
};

export const isBankConfigComplete = (config: BankAccountConfig) => Boolean(
  config.bankName.trim() && config.accountName.trim() && config.accountNumber.trim(),
);
