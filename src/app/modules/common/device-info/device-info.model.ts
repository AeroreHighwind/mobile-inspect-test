export interface IDeviceInfo {
  /** Stable, locally-persisted identifier for this browser/device */
  deviceId: string;
  /** Best-effort device/model name (e.g. "iPhone", "Pixel 7", "Desktop") */
  deviceModel: string;
  /** Operating system name (e.g. "iOS", "Android", "Windows", "macOS", "Linux") */
  os: string;
  /** OS version string, if it can be determined (e.g. "17.4", "13", "10") */
  osVersion: string;
  /** Browser name (e.g. "Chrome", "Safari", "Firefox", "Edge") */
  browser: string;
  /** Browser version, if it can be determined */
  browserVersion: string;
}
