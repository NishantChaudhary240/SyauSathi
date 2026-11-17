export const OTP_DELIVERY_PROVIDER = Symbol('OTP_DELIVERY_PROVIDER');

export interface OtpDeliveryProvider {
  sendOtp(mobileNumber: string, otp: string): Promise<void>;
}
