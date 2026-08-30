import {initializeApp} from "firebase-admin/app";

initializeApp();

export {
  createPairingCode,
  redeemPairingCode,
  sendDeviceCommand,
  requestUnlock,
  resolveUnlockRequest,
  acknowledgeCommand,
  registerDeviceToken,
  unpairDevice,
} from "./callables";

export {expireTimedLocks} from "./triggers";
