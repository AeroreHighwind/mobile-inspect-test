import { Injectable } from '@angular/core';
import { IDeviceInfo } from './device-info/device-info.model';

const STORAGE_KEY = 'app_device_id';

@Injectable({ providedIn: 'root' })
export class DeviceInfoService {

  /**
   * Returns a stable device id. Generated once and persisted in localStorage
   * so it survives reloads (but not reinstalls / cleared storage / different browsers).
   */
  getDeviceId(): string {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = this.generateUuid();
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      // localStorage unavailable (e.g. private mode edge cases) — fall back to a session-only id
      return this.generateUuid();
    }
  }

  collect(): IDeviceInfo {
    const ua = navigator.userAgent || '';
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

    const { os, osVersion } = this.parseOs(ua, platform);
    const { browser, browserVersion } = this.parseBrowser(ua);
    const deviceModel = this.parseDeviceModel(ua, os);

    return {
      deviceId: this.getDeviceId(),
      deviceModel,
      os,
      osVersion,
      browser,
      browserVersion
    };
  }

  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    // RFC4122-ish fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private parseOs(ua: string, platform: string): { os: string; osVersion: string } {
    const checks: Array<[RegExp, string, RegExp?]> = [
      [/Windows NT (\d+\.\d+)/, 'Windows'],
      [/Mac OS X (\d+[._]\d+[._]?\d*)/, 'macOS'],
      [/Android (\d+(\.\d+)*)/, 'Android'],
      [/iPhone OS (\d+[._]\d+[._]?\d*)/, 'iOS'],
      [/iPad; CPU OS (\d+[._]\d+[._]?\d*)/, 'iPadOS'],
      [/CrOS [^\s]+ (\d+\.\d+\.\d+)/, 'Chrome OS'],
      [/Linux/, 'Linux']
    ];

    for (const [regex, name] of checks) {
      const match = ua.match(regex);
      if (match) {
        return { os: name, osVersion: (match[1] || '').replace(/_/g, '.') };
      }
    }

    if (/Win/.test(platform)) return { os: 'Windows', osVersion: '' };
    if (/Mac/.test(platform)) return { os: 'macOS', osVersion: '' };

    return { os: 'Unknown', osVersion: '' };
  }

  private parseBrowser(ua: string): { browser: string; browserVersion: string } {
    // Order matters: Edge/Opera/Brave embed "Chrome" and "Safari" tokens too.
    const checks: Array<[RegExp, string]> = [
      [/Edg\/(\d+[\d.]*)/, 'Edge'],
      [/OPR\/(\d+[\d.]*)/, 'Opera'],
      [/Brave\/(\d+[\d.]*)/, 'Brave'],
      [/SamsungBrowser\/(\d+[\d.]*)/, 'Samsung Internet'],
      [/Firefox\/(\d+[\d.]*)/, 'Firefox'],
      [/CriOS\/(\d+[\d.]*)/, 'Chrome'], // Chrome on iOS
      [/FxiOS\/(\d+[\d.]*)/, 'Firefox'], // Firefox on iOS
      [/Chrome\/(\d+[\d.]*)/, 'Chrome'],
      [/Version\/(\d+[\d.]*).*Safari/, 'Safari']
    ];

    for (const [regex, name] of checks) {
      const match = ua.match(regex);
      if (match) {
        return { browser: name, browserVersion: match[1] };
      }
    }

    return { browser: 'Unknown', browserVersion: '' };
  }

  private parseDeviceModel(ua: string, os: string): string {
    // Android device model typically appears between "; " and " Build/" or before ")"
    const androidModel = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|\))/);
    if (androidModel) return androidModel[1].trim();

    if (/iPad/.test(ua)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPod/.test(ua)) return 'iPod';

    // No reliable JS API exposes exact desktop hardware model; fall back to a general label.
    if (os === 'Windows' || os === 'macOS' || os === 'Linux' || os === 'Chrome OS') {
      return 'Desktop';
    }

    return 'Unknown';
  }
}